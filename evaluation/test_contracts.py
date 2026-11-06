import unittest
from contracts import summarize, validate_observation


class EvaluationContracts(unittest.TestCase):
    def observation(self):
        return dict(id="case", user_input="walker", response="Observed answer", reference="Expected answer",
                    policy_reference="Expected rules", retrieved_contexts=["Observed rule"], price=90, plan_limit=400)

    def test_missing_real_response_cannot_be_scored(self):
        row = self.observation()
        row["response"] = ""
        with self.assertRaises(ValueError):
            validate_observation(row)

    def test_missing_context_cannot_be_scored(self):
        row = self.observation()
        row["retrieved_contexts"] = []
        with self.assertRaises(ValueError):
            validate_observation(row)

    def test_failures_are_not_averaged_as_zero(self):
        result = summarize([{"scores": {"faithfulness": 0.8}}, {"scores": {"faithfulness": None}}], ["faithfulness"])
        self.assertEqual(result["faithfulness"], {"mean": 0.8, "scored_cases": 1, "total_cases": 2})


if __name__ == "__main__":
    unittest.main()