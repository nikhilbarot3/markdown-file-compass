import unittest
from contracts import summarize, validate_observation, relevant_fraction, citation_audit


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

    def test_precision_is_relevant_fraction_not_ranked_average_precision(self):
        self.assertEqual(relevant_fraction([1, 0, 1, 0]), 0.5)
        self.assertEqual(relevant_fraction([0, 0, 1, 1]), 0.5)

    def test_precision_all_irrelevant_is_zero(self):
        self.assertEqual(relevant_fraction([0, 0]), 0)

    def test_missing_precision_evidence_cannot_be_scored(self):
        with self.assertRaises(ValueError):
            relevant_fraction([])

    def test_unknown_citation_is_not_hidden(self):
        audit = citation_audit("Requires authorization (Section 4.5). See Section 9.9.",
                               ["Section 4.5: Authorization required."])
        self.assertEqual(audit["missing_sections"], ["9.9"])

    def test_known_citation_is_not_a_mismatch(self):
        self.assertEqual(citation_audit("See Section 4.5.", ["Section 4.5: rule"])["missing_sections"], [])


if __name__ == "__main__":
    unittest.main()