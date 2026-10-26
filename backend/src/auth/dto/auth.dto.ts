import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254)
  email!: string;

  // 8 minimum; 128 max stops someone sending a 10 MB "password" to burn server CPU.
  @IsString() @MinLength(8) @MaxLength(128)
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
