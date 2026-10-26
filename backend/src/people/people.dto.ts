import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Query strings arrive as text: "true" / "false" become real booleans. */
const toBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class PeopleQueryDto {
  /** Which tab of the People screen: "coaches" or "members". */
  @IsIn(['coaches', 'members'])
  kind!: 'coaches' | 'members';

  /** Search box: part of a name, any capitalisation ("ama" finds "Amara"). */
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(60)
  q?: string;

  /** Coaches tab only: keep coaches that list this specialty (exact match, e.g. "Career"). */
  @IsOptional() @IsString() @MaxLength(40)
  specialty?: string;

  /** Coaches tab only: `true` keeps only coaches who switched "available" on. */
  @IsOptional() @Transform(toBoolean) @IsBoolean()
  available?: boolean;

  /** Opaque "continue after this person" marker from the previous page's `nextCursor`. */
  @IsOptional() @IsString() @MaxLength(200)
  cursor?: string;

  /** Page size. Capped so one request can never return thousands of rows. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 20;
}
