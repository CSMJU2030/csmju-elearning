import { Module } from '@nestjs/common';

import { EnrollmentsController, LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  controllers: [EnrollmentsController, LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
