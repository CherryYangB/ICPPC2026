import { PartialType } from '@nestjs/swagger'
import { CreateInstitutionDto } from './create-institution.dto'

/** 编辑机构：全部字段可选；isLit / litAt 只能通过 PATCH /:id/lit 修改 */
export class UpdateInstitutionDto extends PartialType(CreateInstitutionDto) {}
