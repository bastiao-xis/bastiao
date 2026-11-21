import { ParseUUIDPipe } from '@nestjs/common';

export const uuid = () => new ParseUUIDPipe({ version: '4', errorHttpStatusCode: 404 });
