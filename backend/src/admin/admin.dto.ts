import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const BAN_REASONS = ['Harassment of a coach', 'Spam or scams', 'Payment fraud', 'Other'] as const;

export class BanDto {
  @IsIn(BAN_REASONS as unknown as string[])
  reason!: (typeof BAN_REASONS)[number];

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
