import passport, { Profile } from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from './db';
import { config } from './config';
import type { AppUser } from './types';

export function configurePassport(): typeof passport {
  passport.serializeUser((user, done) => {
    done(null, (user as AppUser).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user ?? false);
    } catch (error) {
      done(error as Error);
    }
  });

  if (config.googleClientId && config.googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.googleClientId,
          clientSecret: config.googleClientSecret,
          callbackURL: config.googleCallbackUrl,
        },
        async (_accessToken, _refreshToken, profile: Profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;

            if (!email) {
              done(new Error('Google account did not return an email address'));
              return;
            }

            const user = await prisma.user.upsert({
              where: { email },
              update: {
                name: profile.displayName,
                picture: profile.photos?.[0]?.value ?? null,
                googleId: profile.id,
              },
              create: {
                email,
                name: profile.displayName,
                picture: profile.photos?.[0]?.value ?? null,
                googleId: profile.id,
              },
            });

            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        },
      ),
    );
  }

  return passport;
}
