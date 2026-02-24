import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates (or propagates) a correlation ID for every HTTP request.
 * The ID is attached to the request object and echoed back in the response header.
 *
 * Downstream code can read `req.correlationId` for structured log tagging.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-correlation-id'] as string | undefined;
    const correlationId = incoming || uuidv4();

    // Attach to request for downstream consumption
    (req as any).correlationId = correlationId;

    // Echo back in response header
    res.setHeader('X-Correlation-Id', correlationId);

    next();
  }
}
