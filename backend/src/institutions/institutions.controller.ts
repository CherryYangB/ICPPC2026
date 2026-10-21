import { Controller, Get, Query } from '@nestjs/common'
import { InstitutionsService } from './institutions.service'
import { QueryInstitutionsDto } from './dto/query-institutions.dto'
import { InstitutionListResponse } from './dto/institution.dto'

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get()
  findAll(@Query() query: QueryInstitutionsDto): Promise<InstitutionListResponse> {
    return this.institutionsService.findAll(query)
  }
}