import { BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
    constructor(private usersService: UsersService, private jwtService: JwtService) {}

    async signup(email: string, username: string, password: string) {
        if (! await this.isEmailAvailable(email)) {
            throw new BadRequestException('email in use');
        }
        if (! await this.isUsernameAvailable(username)) {
            throw new BadRequestException('username in use');
        }
        const encryptedPasword = await this.encryptPassword(password);
        const user = await this.usersService.create(email, username, encryptedPasword);
        return { id: user.id, access_token: this.generateAccessToken(user) };
    }

    async signin(username: string, password: string) {
        const user = await this.usersService.findByName(username);
        if (!user) {
            throw new NotFoundException('user not found');
        }
        const [salt, storedHash] = user.password.split('.');
        const hash = (await scrypt(password, salt, 32)) as Buffer;
        if (storedHash !== hash.toString('hex')) {
            throw new BadRequestException('bad password');
        }
        return { id: user.id, access_token: this.generateAccessToken(user) };
    }

    private async isEmailAvailable(email: string) {
        const user = await this.usersService.findByEmail(email);
        if (!user) { return true; }
        return false;
    }

    private async isUsernameAvailable(username: string) {
        const user = await this.usersService.findByName(username);
        if (!user) { return true; }
        return false;
    }

    private async encryptPassword(password: string) {
        const salt = randomBytes(8).toString('hex');
        const hash = (await scrypt(password, salt, 32)) as Buffer;
        const result = salt + '.' + hash.toString('hex');
        return result;
    }

    private generateAccessToken(user: User) {
        const payload = { username: user.username, sub: user.id };
        return this.jwtService.sign(payload);
    }
}
