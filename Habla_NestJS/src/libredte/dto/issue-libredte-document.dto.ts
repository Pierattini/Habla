import { IsIn, IsOptional } from 'class-validator';

export type LibreDteDocumentKind = 'BOLETA_AFECTA' | 'BOLETA_EXENTA' | 'FACTURA_AFECTA' | 'FACTURA_EXENTA';

export class IssueLibreDteDocumentDto {
  @IsOptional()
  @IsIn(['BOLETA_AFECTA', 'BOLETA_EXENTA', 'FACTURA_AFECTA', 'FACTURA_EXENTA'])
  kind?: LibreDteDocumentKind;
}
