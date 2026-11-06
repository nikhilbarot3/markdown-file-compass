"""Validation and aggregation without network calls."""
import math


def validate_observation(row):
    for field in ("id", "user_input", "response", "reference", "policy_reference"):
        if not isinstance(row.get(field), str) or not row[field].strip():
            raise ValueError(f"Missing nonempty {field}")
    contexts = row.get("retrieved_contexts")
    if not isinstance(contexts, list) or not contexts or not all(isinstance(c, str) and c.strip() for c in contexts):
        raise ValueError("Missing retrieved policy contexts")
    for field in ("price", "plan_limit"):
        value = row.get(field)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError(f"Invalid observed {field}")


def summarize(results, names):
    summary = {}
    for name in names:
        valid = [r["scores"][name] for r in results if isinstance(r.get("scores", {}).get(name), (int, float)) and math.isfinite(r["scores"][name])]
        summary[name] = {"mean": sum(valid) / len(valid) if valid else None,
                         "scored_cases": len(valid), "total_cases": len(results)}
    return summary