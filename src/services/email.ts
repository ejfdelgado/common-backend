import sgMail, { MailDataRequired } from "@sendgrid/mail";
import { Request, Response } from 'express';
import { General } from '../tools/General';
import { InesperadoException } from "../errors";
import { BucketsSrv } from "./bucket";
import { MyTemplate, sortify } from "ejfdelgado-common-ts";
import { ApiResponse } from "../types";


export class EmailHandler {
  static async send(req: Request, res: Response) {
    let debug = false;
    const body = General.readParam(req, "body");
    debug = General.readParam(req, "debug", "0", false) != "0";
    const EMAIL_SENDER = process.env.EMAIL_SENDER;
    if (!process.env.SEND_GRID_VARIABLE || !EMAIL_SENDER) {
      throw new InesperadoException("Missconfiguration");
    }
    if (debug) {
      console.log(`Using: SEND_GRID_VARIABLE ${JSON.stringify(process.env.SEND_GRID_VARIABLE.substring(0, 7))}...`);
    }
    sgMail.setApiKey(
      process.env.SEND_GRID_VARIABLE
    );
    let contenido: string | null = null;
    const normalizedTemplate = body.template.replace(/^\s*\//, "");
    contenido = await BucketsSrv.readTextFile(normalizedTemplate, body.bucketName, req);
    if (!contenido) {
      contenido = '<body style="font-family: sans-serif;">Misconfigured</body>';
    }
    if (debug) {
      console.log(contenido);
    }
    const renderer = new MyTemplate();
    if (debug) {
      console.log(JSON.stringify(body.params, null, 4));
    }
    const contenidoFinal = renderer.render(
      contenido,//template
      body.params//params
    );
    let to = body.to;
    if (!to) {
      to = [EMAIL_SENDER];
    } else if (to instanceof Array && to.length == 0) {
      to.push(EMAIL_SENDER);
    } else if (typeof to == "string") {
      to = [to];
    }
    const msg: MailDataRequired = {
      to,
      from: EMAIL_SENDER,
      subject: body.subject,
      html: contenidoFinal,
    };

    if (body.replyTo) {
      msg.replyTo = body.replyTo;
      if (debug) {
        console.log(`replyTo: ${msg.replyTo}`);
      }
    }

    if (debug) {
      console.log(`Using EMAIL_SENDER ${JSON.stringify(EMAIL_SENDER)}`);
      //console.log(JSON.stringify(body.params, null, 4));
      //console.log(JSON.stringify(contenidoFinal, null, 4));
    }

    if (debug) {
      res.status(200).set({ 'content-type': 'text/html; charset=utf-8' }).send(contenidoFinal).end();
    } else {
      const answer: ApiResponse = {
        success: true,
        message: 'Data received successfully',
        data: null,
        timestamp: new Date()
      };
      try {
        answer.data = await sgMail.send(msg);
      } catch (err) {
        console.log(sortify(err));
        throw err;
      }
      res.status(200).json(answer).end();
    }
  }
}
