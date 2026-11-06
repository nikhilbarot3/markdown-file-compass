import unittest
from pydantic import BaseModel
from evaluate import UnrankedContextPrecision, NAMES


class Verdict(BaseModel):
    verdict: int
    reason: str = "sample test"


class PrecisionMetricTests(unittest.TestCase):
    def test_ragas_override_uses_unranked_fraction_and_retains_verdicts(self):
        metric = UnrankedContextPrecision()
        score = metric._calculate_average_precision([Verdict(verdict=v) for v in [1, 0, 1, 0]])
        self.assertEqual(score, 0.5)
        self.assertEqual([v["verdict"] for v in metric.last_verifications], [1, 0, 1, 0])

    def test_current_protocol_includes_precision_not_correctness(self):
        self.assertEqual(NAMES, ["faithfulness", "context_recall", "context_precision"])


if __name__ == "__main__":
    unittest.main()