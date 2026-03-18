import sgMail, { MailDataRequired } from "@sendgrid/mail";
import { Request, Response } from 'express';
import { General } from '../tools/General';
import { InesperadoException } from "../errors";
import { BucketsSrv } from "./bucket";
import { MyTemplate, sortify } from "ejfdelgado-common-ts";
import { ApiResponse, AuthenticatedRequest, AuthenticatedUser } from "../types/types";
import { RolesAdminSrv } from "./rolesAdmin";
import { google } from "googleapis";

export interface SendRequestType {
  template: string;
  bucketName?: string;
  params: any;
  subject: string;
  to?: string[] | string;
  replyTo?: string;
  gmailUser?: AuthenticatedUser | null,
}

export class EmailHandler {

  static async sendInternal(
    body: SendRequestType,
    send: boolean = false,
    req?: AuthenticatedRequest,
    waitSend: boolean = true,
    debug: boolean = false) {

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

    const reponse: any = { msg, contenidoFinal };

    if (send) {
      if (body.gmailUser) {
        console.log("Using gmail sender...");
        const { auth } = await RolesAdminSrv.getOfflineAuth(body.gmailUser);
        const gmail = google.gmail({
          version: 'v1',
          auth: auth
        });

        let tos = msg.to;
        if (tos instanceof Array) {
          tos = tos.join(', ');
        }

        const message = [
          `From: "${body.gmailUser.displayName}" <${body.gmailUser.email}>`,
          `To: ${tos}`,
          `Subject: ${msg.subject}`,
          'Content-Type: multipart/alternative; boundary="boundary123"',
          '',
          '--boundary123',
          'Content-Type: text/plain; charset="UTF-8"',
          '',
          'Plain text version',
          '',
          '--boundary123',
          'Content-Type: text/html; charset="UTF-8"',
          '',
          contenidoFinal,
          '',
          '--boundary123--'
        ].join('\r\n')

        const encodedMessage = Buffer.from(message)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedMessage
          }
        });
        //console.log(`res.status = ${res.status}`);
        //res.status;
        //(res as any)
        if (!res.data?.id) {
          throw new InesperadoException("Email error");
        }
      } else {
        if (waitSend) {
          reponse.result = await sgMail.send(msg);
        } else {
          reponse.result = sgMail.send(msg);
        }
      }
    }

    return reponse;
  }

  static async send(req: Request, res: Response) {
    let debug = false;
    const body = General.readParam(req, "body");
    debug = General.readParam(req, "debug", "0", false) != "0";

    const { msg, contenidoFinal } = await EmailHandler.sendInternal(body, false, req, true, debug);

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

  static async contactUs(req: Request, res: Response) {
    const form = General.readParam(req, "form");

    const response = await EmailHandler.sendInternal({
      params: { form },
      subject: `Contact!`,
      template: "mails/contact_us_orig.html",
      to: process.env.EMAIL_CONTACT_US,
    }, true, undefined, false);

    const answer: ApiResponse = {
      success: true,
      message: 'Ok',
      data: null,
      timestamp: new Date()
    };

    res.status(200).json(answer).end();
  }

  static async invite(req: Request, res: Response) {
    const email = General.readParam(req, "email");

    const send = true;
    const debug = false;

    let domain = "https://localhost:4200";
    domain = "https://chat.pais.tv";

    const form = {
      url_image: "https://storage.googleapis.com/pro-ejflab-assets/images/landscape.jpg",
      email: email,
      title: "Hola!, te damos la bienvenida",
      content: "Gracias por recibir la invitación al fascinante mundo de los asistentes virtuales. Hemos preparado todo para tu llegada.",
      footer: "Términos y condiciones en revisión",
      action: {
        label: "Ingresa aquí",
        link: domain + "/#/?ref=" + encodeURIComponent(Buffer.from(JSON.stringify({ email }))
          .toString('base64')),
      },
    };

    const body = {
      gmailUser: {
        uid: process.env.DEFAULT_OFFLINE_AUTH,
      } as any,
      params: { form },
      subject: `Bienvenida del Asistente Virtual`,
      template: "mails/onboard_orig.html",
      to: form.email,
    };

    const waitSend = true;

    const response = await EmailHandler.sendInternal(
      body, send, undefined, waitSend, debug);

    const { contenidoFinal } = response;

    if (debug) {
      res.status(200).set({ 'content-type': 'text/html; charset=utf-8' }).send(contenidoFinal).end();
    } else {
      const answer: ApiResponse = {
        success: true,
        message: 'Ok',
        data: null,
        timestamp: new Date()
      };

      res.status(200).json(answer).end();
    }
  }
}
