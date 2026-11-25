import { General } from "../tools/General";
import { Request, Response } from "express";
import { ApiResponse, AuthenticatedRequest } from "../types/types";
import { ParametrosIncompletosException } from "../errors";
import { MyStore } from "./firestore";
import {
  ANONYMOUS_PROFILE_IMAGES,
  LeaderEntryType,
} from "../types/LeaderBoardTypes";

const COLLECTION_MAIN = "leaderboard_actual";

export class LeaderBoardSrv {
  static getRandomPicture() {
    return ANONYMOUS_PROFILE_IMAGES[0];
  }

  static async write(req: AuthenticatedRequest, res: Response) {
    const answer: ApiResponse = {
      success: true,
      message: "Ok",
      data: null,
      timestamp: new Date(),
    };
    const body = General.readParam(req, "body", null, true);
    const { roomId, displayName, points } = body;

    if (!roomId) {
      throw new ParametrosIncompletosException("Missing roomId");
    }

    if (typeof points !== "number") {
      throw new ParametrosIncompletosException("Missing points");
    }

    const user = req.user;

    if (user) {
      // loged user
      // 1. Search an old entry with the same: roomId and user.uid
      const oldArray = await MyStore.paginate(COLLECTION_MAIN, [], 0, 1, [
        {
          key: "user.uid",
          oper: "==",
          value: user.uid,
        },
        {
          key: "roomId",
          oper: "==",
          value: roomId,
        },
      ]);
      if (oldArray.length > 0) {
        const old: LeaderEntryType = oldArray[0];
        // Update if improved
        if (old.id) {
          let needsUpdate = false;
          if (points > old.points) {
            needsUpdate = true;
            old.points = points;
          }

          if (old.user.photoURL != user.photoURL) {
            needsUpdate = true;
            old.user.photoURL = user.photoURL; // Refresh old photo
          }

          if (needsUpdate) {
            old.updated = Date.now();
            await MyStore.updateById(COLLECTION_MAIN, old.id, old);
          }
        }
      } else {
        // Just create
        const entry: LeaderEntryType = {
          created: Date.now(),
          points,
          roomId,
          updated: Date.now(),
          user: {
            uid: user.uid,
            displayName: user.name,
            isAnonymous: false,
            photoURL: user.picture
              ? user.picture
              : LeaderBoardSrv.getRandomPicture(),
          },
        };
        await MyStore.create(COLLECTION_MAIN, entry);
      }
    } else {
      // anonymous
      if (!displayName) {
        throw new ParametrosIncompletosException("Missing displayName");
      }
      // 1. All the time create it given the
      const entry: LeaderEntryType = {
        created: Date.now(),
        points,
        roomId,
        updated: Date.now(),
        user: {
          displayName,
          isAnonymous: true,
          photoURL: LeaderBoardSrv.getRandomPicture(),
        },
      };
      await MyStore.create(COLLECTION_MAIN, entry);
    }

    res.status(200).json(answer).end();
  }

  static async read(req: Request, res: Response) {
    const answer: ApiResponse = {
      success: true,
      message: "Ok",
      data: null,
      timestamp: new Date(),
    };
    const roomId = General.readParam(req, "roomId", null, true);
    const limit = Math.min(parseInt(General.readParam(req, "limit", 10), 10) || 10, 100);
    const offset = Math.max(parseInt(General.readParam(req, "offset", 0), 10) || 0, 0);

    answer.data = await MyStore.paginate(
      COLLECTION_MAIN,
      [
        {
          name: "points",
          dir: "DESC",
        },
      ],
      offset,
      limit,
      [
        {
          key: "roomId",
          oper: "==",
          value: roomId,
        },
      ],
    );

    res.status(200).json(answer).end();
  }
}
