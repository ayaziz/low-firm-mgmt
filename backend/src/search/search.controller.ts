import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @CurrentUser() user: any,
    @Query('q') q: string,
    @Query('type') type?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.globalSearch(
      user.tenantSlug, user.sub, q, type, cursor,
      limit ? parseInt(limit, 10) : undefined,
      !!user.stepUp,
    );
  }
}
