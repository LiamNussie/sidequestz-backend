import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PushDevice, PushDeviceDocument } from './schemas/push-device.schema';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectModel(PushDevice.name)
    private readonly pushDeviceModel: Model<PushDeviceDocument>,
  ) {}

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const devices = await this.pushDeviceModel
      .find({ userId })
      .select('token platform')
      .lean()
      .exec();

    if (!devices.length) {
      return;
    }

    for (const device of devices) {
      const token = device.token;
      if (token.startsWith('ExponentPushToken')) {
        try {
          const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: token,
              title,
              body,
              data: data ?? {},
              sound: 'default',
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            this.logger.warn(
              `Expo push failed (${String(res.status)}): ${text.slice(0, 200)}`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Expo push error for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        this.logger.debug(
          `Push token not Expo format; skipping FCM (user ${userId}, platform ${String(device.platform)})`,
        );
      }
    }
  }
}
