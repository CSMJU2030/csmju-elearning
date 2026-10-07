import { Module } from '@nestjs/common';

import { CertificateTemplatesController, CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  controllers: [CertificatesController, CertificateTemplatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
