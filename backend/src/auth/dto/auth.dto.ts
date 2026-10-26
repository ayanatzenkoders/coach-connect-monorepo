import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from './password-rule.js';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email!: string;

  // 8-128 characters (128 stops someone sending a 10 MB "password" to burn server CPU),
  // with a lowercase letter, an uppercase letter and a number.
  @IsString() @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password!: string;

  @IsString() @Length(1, 80)
  name!: string;

  /** Random id the app creates once per install and keeps in secure storage. */
  @IsString() @Length(8, 128)
  deviceId!: string;

  @IsOptional() @IsString() @MaxLength(100)
  deviceName?: string;
}

export class LoginDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email!: string;

  @IsString() @IsNotEmpty() @MaxLength(128)
  password!: string;

  @IsString() @Length(8, 128)
  deviceId!: string;

  @IsOptional() @IsString() @MaxLength(100)
  deviceName?: string;
}

export class RefreshDto {
  @IsString() @IsNotEmpty() @MaxLength(256)
  refreshToken!: string;
}

export class VerifyEmailDto {
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email!: string;
}

export class VerifyResetCodeDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email!: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class ResetPasswordDto {
  /** The short-lived token returned by verify-code. It proves the emailed code was correct. */
  @IsString() @IsNotEmpty() @MaxLength(2000)
  resetToken!: string;

  @IsString() @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}
