import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Email delivery service.
 *
 * In production: sends via SMTP (configured via env vars).
 * In development: logs to console (no SMTP connection needed).
 *
 * Env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('SMTP_FROM', 'noreply@loma.local');
    this.enabled = !!this.config.get<string>('SMTP_HOST');

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER', ''),
          pass: this.config.get<string>('SMTP_PASS', ''),
        },
      });
      this.logger.log(`Email transport configured: ${this.config.get<string>('SMTP_HOST')}`);
    } else {
      this.logger.log('SMTP not configured — emails will be logged to console');
    }
  }

  async send(payload: EmailPayload): Promise<boolean> {
    const { to, subject, text, html } = payload;

    if (!this.transporter) {
      this.logger.log(
        `[EMAIL-DEV] To: ${Array.isArray(to) ? to.join(', ') : to} | Subject: ${subject} | Body: ${text || '(html)'}`,
      );
      return true;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
      });
      this.logger.log(`Email sent: ${info.messageId} → ${to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Email send failed: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Send a notification email based on an in-app notification payload.
   */
  async sendNotificationEmail(userEmail: string, title: string, body: string): Promise<boolean> {
    return this.send({
      to: userEmail,
      subject: `[LOMA] ${title}`,
      text: body,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #1976d2;">${title}</h2>
          <p>${body}</p>
          <hr />
          <small style="color: #999;">This is an automated notification from LOMA.</small>
        </div>
      `,
    });
  }
}
