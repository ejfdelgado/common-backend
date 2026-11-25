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
    return ANONYMOUS_PROFILE_IMAGES[
      Math.floor(Math.random() * ANONYMOUS_PROFILE_IMAGES.length)
    ];
  }

  // Firestore ids can't contain "/" (it would be read as a sub-path),
  // so roomId is encoded; uid from Firebase Auth is already safe.
  static loggedEntryId(roomId: string, uid: string) {
    return `${encodeURIComponent(roomId)}_${uid}`;
  }

  static async write(req: AuthenticatedRequest, res: Response) {
    const answer: ApiResponse = {
      success: true,
      message: "Ok",
      data: null,
      timestamp: new Date(),
    };
    const body = General.readParam(req, "body", null, true);
    const { displayName, points } = body;
    let { roomId } = body;

    if (!roomId) {
      throw new ParametrosIncompletosException("Missing roomId");
    }

    roomId = String(roomId);

    if (typeof points !== "number") {
      throw new ParametrosIncompletosException("Missing points");
    }

    const user = req.user;

    if (user) {
      // loged user
      // One document per (roomId, uid): the deterministic id plus the
      // transaction make concurrent writes from the same user safe.
      const docId = LeaderBoardSrv.loggedEntryId(roomId, user.uid);
      await MyStore.runTransaction(async (transaction: any) => {
        const old: LeaderEntryType | undefined = await MyStore.readById(
          COLLECTION_MAIN,
          docId,
          transaction,
        );
        const now = Date.now();
        if (old) {
          // Update if improved
          let needsUpdate = false;
          if (points > old.points) {
            needsUpdate = true;
            old.points = points;
          }

          // Only refresh with a real picture; never re-roll a random one
          if (user.picture && old.user.photoURL != user.picture) {
            needsUpdate = true;
            old.user.photoURL = user.picture;
          }

          if (needsUpdate) {
            old.updated = now;
            const { id, ...data } = old;
            await MyStore.updateById(COLLECTION_MAIN, docId, data, transaction);
          }
        } else {
          // Just create
          const entry: LeaderEntryType = {
            created: now,
            points,
            roomId,
            updated: now,
            user: {
              uid: user.uid,
              displayName: user.name || user.email?.split("@")[0] || "Player",
              isAnonymous: false,
              photoURL: user.picture
                ? user.picture
                : LeaderBoardSrv.getRandomPicture(),
            },
          };
          await MyStore.createById(COLLECTION_MAIN, docId, entry, transaction);
        }
      });
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
    let roomId = General.readParam(req, "roomId", null, true);
    roomId = String(roomId);
    const limit = Math.min(
      parseInt(General.readParam(req, "limit", 10), 10) || 10,
      100,
    );
    const offset = Math.max(
      parseInt(General.readParam(req, "offset", 0), 10) || 0,
      0,
    );

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
