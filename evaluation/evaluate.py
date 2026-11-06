"""Score collected sample answers with RAGAS, separately from match scores."""
import argparse
import asyncio
import json
import math
import os
import subprocess
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from dotenv import load_dotenv
os.environ.setdefault("RAGAS_DO_NOT_TRACK", "true")
from langchain_core.outputs import Generation, LLMResult
from ragas import SingleTurnSample
from ragas.llms import BaseRagasLLM
from ragas.metrics import Faithfulness, LLMContextRecall, FactualCorrectness
from ragas.run_config import RunConfig
from contracts import summarize, validate_observation

HERE = Path(__file__).resolve().parent
NAMES = ["faithfulness", "context_recall", "factual_correctness"]


class GatewayJudge(BaseRagasLLM):
    def generate_text(self, prompt, n=1, temperature=0.01, stop=None, callbacks=None):
        generations = []
        for _ in range(n):
            result = subprocess.run(["bun", str(HERE / "judge.mjs")], input=prompt.to_string(),
                                    capture_output=True, text=True, cwd=HERE.parent, timeout=180)
            if result.returncode:
                raise RuntimeError("AI Gateway judge failed; inspect gateway logs")
            generations.append(Generation(text=result.stdout))
        return LLMResult(generations=[generations])

    async def agenerate_text(self, prompt, n=1, temperature=0.01, stop=None, callbacks=None):
        return await asyncio.to_thread(self.generate_text, prompt, n, temperature, stop, callbacks)

    def is_finished(self, response):
        return bool(response.generations and response.generations[0])


async def run(args):
    load_dotenv(HERE.parent / ".env.local", override=False)
    observations = [json.loads(line) for line in args.input.read_text().splitlines() if line.strip()]
    judge = GatewayJudge(run_config=RunConfig(max_retries=0, timeout=180))
    metrics = [Faithfulness(llm=judge), LLMContextRecall(llm=judge), FactualCorrectness(llm=judge)]
    results = []
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for row in observations:
        result = {"id": row["id"], "scores": {}, "errors": {}}
        try:
            if row.get("collection_error"):
                raise ValueError("Collection failed")
            validate_observation(row)
            policy = row["retrieved_contexts"]
            sql = f"SQL facts (sample): equipment price ${row['price']}; plan annual limit ${row['plan_limit']}."
            for name, metric in zip(NAMES, metrics):
                sample = SingleTurnSample(user_input=row["user_input"], response=row["response"],
                    reference=row["policy_reference"] if name == "context_recall" else row["reference"],
                    retrieved_contexts=policy if name == "context_recall" else policy + [sql])
                try:
                    score = float(await metric.single_turn_ascore(sample, timeout=240))
                    if not math.isfinite(score):
                        raise ValueError("Nonfinite score")
                    result["scores"][name] = score
                except Exception as error:
                    result["scores"][name] = None
                    result["errors"][name] = type(error).__name__
        except ValueError:
            result["errors"]["collection"] = "Invalid or failed live observation"
        results.append(result)
        report = {"evaluated_at": datetime.now(timezone.utc).isoformat(), "ragas_version": version("ragas"),
                  "judge_model": "openai/gpt-6-astra", "dataset": str(args.input),
                  "summary": summarize(results, NAMES), "cases": results,
                  "limitations": ["Synthetic text cases, not clinical validation.",
                                  "Displayed policy facts are not an exact prompt trace.",
                                  "Context precision omitted because displayed facts are section-sorted, not rank-ordered."]}
        args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
        print(json.dumps(result))
    print(json.dumps(report["summary"], indent=2))
    return any(r["errors"] for r in results)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.input.exists() or not args.input.read_text().strip():
        parser.error("Collect nonempty live observations first")
    raise SystemExit(1 if asyncio.run(run(args)) else 0)