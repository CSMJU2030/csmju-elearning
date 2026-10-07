import { Module } from '@nestjs/common';

import { ContentAccessService } from '../access/content-access.service';
import { CoursesController, QuizQuestionsController, TopicsController, VideosController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  controllers: [CoursesController, TopicsController, VideosController, QuizQuestionsController],
  providers: [ContentService, ContentAccessService],
  exports: [ContentService, ContentAccessService],
})
export class ContentModule {}
