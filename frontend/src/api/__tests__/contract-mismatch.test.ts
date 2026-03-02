import { calendarApi } from '../calendar';
import { courtApi } from '../courts';
import { folderApi } from '../folders';
import { get, post, patch } from '../client';

jest.mock('../client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  del: jest.fn(),
  ApiError: class extends Error {},
}));

const getMock = get as jest.Mock;
const postMock = post as jest.Mock;
const patchMock = patch as jest.Mock;

describe('api contract alignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses /calendar/events routes and rsvp payload for calendar API', async () => {
    getMock.mockResolvedValue({});
    postMock.mockResolvedValue({});
    patchMock.mockResolvedValue({});

    await calendarApi.list({ limit: 20 });
    await calendarApi.getById('evt-1');
    await calendarApi.create({ title: 'A' });
    await calendarApi.updateRsvp('evt-1', 'Accepted');

    expect(getMock).toHaveBeenNthCalledWith(1, '/calendar/events', { limit: 20 });
    expect(getMock).toHaveBeenNthCalledWith(2, '/calendar/events/evt-1');
    expect(postMock).toHaveBeenCalledWith('/calendar/events', { title: 'A' });
    expect(patchMock).toHaveBeenCalledWith('/calendar/events/evt-1/rsvp', { rsvp: 'Accepted' });
  });

  it('uses flat judges endpoints and includes courtId in payload/query', async () => {
    getMock.mockResolvedValue({});
    postMock.mockResolvedValue({});

    await courtApi.listJudges('court-1', { limit: 10 });
    await courtApi.createJudge('court-1', { name: 'Judge 1' });

    expect(getMock).toHaveBeenCalledWith('/courts/judges', { limit: 10, courtId: 'court-1' });
    expect(postMock).toHaveBeenCalledWith('/courts/judges', { name: 'Judge 1', courtId: 'court-1' });
  });

  it('uses /folders/move-document with folderId in body', async () => {
    postMock.mockResolvedValue({});

    await folderApi.moveDocument('folder-1', 'doc-1');

    expect(postMock).toHaveBeenCalledWith('/folders/move-document', { documentId: 'doc-1', folderId: 'folder-1' });
  });
});
