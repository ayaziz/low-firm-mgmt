import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface SseEvent {
  tenantSlug: string;
  userId: string;
  type: string;
  data: Record<string, any>;
}

/**
 * In-process SSE event bus. In production with multiple backend instances
 * this should be backed by Redis Pub/Sub; the single-instance version
 * uses an RxJS Subject.
 */
@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private readonly bus$ = new Subject<SseEvent>();

  /** Push an event to a specific user within a tenant */
  emit(event: SseEvent): void {
    this.bus$.next(event);
  }

  /** Subscribe to events for a specific user. Returns an SSE-compatible Observable. */
  streamForUser(tenantSlug: string, userId: string): Observable<MessageEvent> {
    return this.bus$.pipe(
      filter((e) => e.tenantSlug === tenantSlug && e.userId === userId),
      map(
        (e) =>
          ({
            data: JSON.stringify({ type: e.type, ...e.data }),
          }) as MessageEvent,
      ),
    );
  }
}
