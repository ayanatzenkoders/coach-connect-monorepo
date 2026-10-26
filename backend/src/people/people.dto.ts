import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PeopleQueryDto {
  /** Which tab of the People screen: "coaches" or "members". */
  @IsIn(['coaches', 'members'])
  kind!: 'coaches' | 'members';

  /** Page size. Capped so one request can never return thousands of rows. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 20;
}
