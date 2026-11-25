import { General } from "../tools/General";
import { Request, Response } from "express";
import { ApiResponse, AuthenticatedRequest } from "../types/types";

export class LeaderBoardSrv {
  // given a roomId, must read
  static async read(req: Request, res: Response) {
    const answer: ApiResponse = {
      success: true,
      message: "Ok",
      data: null,
      timestamp: new Date(),
    };
    const roomId = General.readParam(req, "roomId", null, true);
    const limit = General.readParam(req, "limit", 10, false);
    const offset = General.readParam(req, "offset", 0, false);

    res.status(200).json(answer).end();
  }

  static async write(req: AuthenticatedRequest, res: Response) {
    const answer: ApiResponse = {
      success: true,
      message: "Ok",
      data: null,
      timestamp: new Date(),
    };
    const roomId = General.readParam(req, "roomId", null, true);
    const user = req.user;

    if (user) {
        // loged user
    } else {
        // anonymous
    }

    res.status(200).json(answer).end();
  }
}
