import { Router } from "express";
import { analyzeSmokingRisk } from "./lib/smokingRisk";

const statRouter = Router();

statRouter.post("/", (req, res) => {
  const result = analyzeSmokingRisk(req.body);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.status(200).json(result);
});

export default statRouter;