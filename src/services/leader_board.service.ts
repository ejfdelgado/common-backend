import {
  General,
  decryptClientPass,
  makeJsonToEncriptedTextResponse,
} from "../tools/General";
import { decode } from "@msgpack/msgpack";
import { Request, Response } from "express";
import { ApiResponse, AuthenticatedRequest } from "../types/types";
import { ParametrosIncompletosException } from "../errors";
import { MyStore } from "./firestore";
import {
  ANONYMOUS_PROFILE_IMAGES,
  LeaderEntryType,
  LeaderboardReadType,
} from "../types/LeaderBoardTypes";
import { FirestoreWhereType } from "ejfdelgado-common-ts";

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
    // Same envelope as gemini/query: msgpack-encoded JSON with an
    // RSA-encrypted one-time pass; the response is AES-encrypted with it.
    if (!req.body?.data) {
      throw new ParametrosIncompletosException("Missing data");
    }
    const body = JSON.parse(decode(req.body.data) as string);
    const responsePass = decryptClientPass(body.pass);
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

    makeJsonToEncriptedTextResponse(answer, res, responsePass);
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

    const type: LeaderboardReadType = General.readParam(
      req,
      "type",
      "ALL",
      true,
    );

    if (!["ALL", "SIGNED", "ANONYMOUS"].includes(type)) {
      throw new ParametrosIncompletosException("Invalid type");
    }

    const where: FirestoreWhereType[] = [
      {
        key: "roomId",
        oper: "==",
        value: roomId,
      },
    ];
    if (type == "SIGNED") {
      where.push({
        key: "user.isAnonymous",
        oper: "==",
        value: false,
      });
    } else if (type == "ANONYMOUS") {
      where.push({
        key: "user.isAnonymous",
        oper: "==",
        value: true,
      });
    }

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
      where,
    );

    res.status(200).json(answer).end();
  }
}
