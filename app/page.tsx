'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { RecipeSuggestion } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingCount, setRatingCount] = useState(0);
  const [todaySuggestion, setTodaySuggestion] = useState<RecipeSuggestion | null>(null);
  const [profileName, setProfileName] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          // Get profile info and rating count
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name')
            .eq('user_id', session.user.id)
            .single();

          if (profile) {
            setProfileName(profile.display_name);

            const { count } = await supabase
              .from('ratings')
              .select('*', { count: 'exact', head: true })
              .eq('profile_id', profile.id);

            setRatingCount(count || 0);

            // Fetch today's suggestion if user has enough ratings
            if ((count || 0) >= 10) {
              const response = await fetch('/api/recipes/suggest?for=family&limit=1', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (response.ok) {
                const data = await response.json();
                if (data.suggestions?.length > 0) {
                  setTodaySuggestion(data.suggestions[0]);
                }
              }
            }
          }
        } catch (err) {
          console.error(err);
        }
      }

      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="spinner" />
      </div>
    );
  }

  const progress = Math.min(100, (ratingCount / 30) * 100);
  const needsOnboarding = ratingCount < 30;

  return (
    <div className="safe-top pb-4">
      {user ? (
        <>
          {/* Greeting Header */}
          <div className="px-5 pt-6 pb-4">
            <p className="text-caption mb-1">
              {getGreeting()}, {profileName || 'där'}! 👋
            </p>
            <h1 className="text-display text-2xl">
              {needsOnboarding ? 'Bygg din smakprofil' : 'Vad vill du äta?'}
            </h1>
          </div>

          {/* Onboarding Hero - Show prominently for new users */}
          {needsOnboarding && (
            <div className="px-4 pb-5">
              <Link
                href="/rate"
                className="block card card-elevated overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                      <span className="text-4xl">👆</span>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-bold">{ratingCount}</p>
                      <p className="text-white/80 text-sm">av 30 betyg</p>
                    </div>
                  </div>

                  <h2 className="text-xl font-semibold mb-2">
                    Svajpa {30 - ratingCount} recept till
                  </h2>
                  <p className="text-white/90 text-sm mb-4">
                    Ju fler recept du betygsätter, desto bättre blir förslagen för hela familjen
                  </p>

                  {/* Progress bar */}
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="px-5 py-4 flex items-center justify-between bg-white">
                  <span className="font-semibold text-green-600">Börja betygsätta</span>
                  <span className="text-green-600 text-xl">→</span>
                </div>
              </Link>
            </div>
          )}

          {/* Today's Suggestion - Show for established users */}
          {!needsOnboarding && todaySuggestion && (
            <div className="px-4 pb-5">
              <h2 className="font-semibold mb-3 px-1">🌟 Kvällens toppförslag</h2>
              <Link
                href="/suggest"
                className="block card card-elevated overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="relative aspect-[16/9]">
                  {todaySuggestion.recipe.image_url ? (
                    <Image
                      src={todaySuggestion.recipe.image_url}
                      alt={todaySuggestion.recipe.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <span className="text-6xl">🍽️</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Family match badge */}
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                    <span>👨‍👩‍👧‍👦</span>
                    <span className="font-semibold text-green-600">
                      {Math.round(todaySuggestion.family_score * 100)}% match
                    </span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-xl font-bold mb-1">{todaySuggestion.recipe.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-white/90">
                      {todaySuggestion.recipe.total_time_minutes && (
                        <span>⏱️ {todaySuggestion.recipe.total_time_minutes} min</span>
                      )}
                      {todaySuggestion.recipe.features?.cuisine && (
                        <span className="capitalize">{todaySuggestion.recipe.features.cuisine}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Quick Actions Grid */}
          <div className="px-4 pb-5">
            {!needsOnboarding && <h2 className="font-semibold mb-3 px-1">Snabbval</h2>}
            <div className="grid grid-cols-2 gap-3">
              {needsOnboarding ? (
                <>
                  <Link
                    href="/suggest"
                    className="card p-4 flex flex-col items-center text-center active:scale-[0.98] transition-transform"
                  >
                    <span className="text-3xl mb-2">💡</span>
                    <span className="font-medium text-sm">Se förslag</span>
                    <span className="text-xs text-gray-500">Även utan profil</span>
                  </Link>

                  <Link
                    href="/plan"
                    className="card p-4 flex flex-col items-center text-center active:scale-[0.98] transition-transform"
                  >
                    <span className="text-3xl mb-2">📅</span>
                    <span className="font-medium text-sm">Veckoplan</span>
                    <span className="text-xs text-gray-500">Planera veckan</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/rate"
                    className="card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
                  >
                    <span className="text-2xl">👆</span>
                    <div className="text-left">
                      <span className="font-medium text-sm block">Betygsätt</span>
                      <span className="text-xs text-gray-500">{ratingCount} betyg</span>
                    </div>
                  </Link>

                  <Link
                    href="/suggest"
                    className="card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
                  >
                    <span className="text-2xl">💡</span>
                    <div className="text-left">
                      <span className="font-medium text-sm block">Alla förslag</span>
                      <span className="text-xs text-gray-500">Utforska recept</span>
                    </div>
                  </Link>

                  <Link
                    href="/plan"
                    className="card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform col-span-2"
                  >
                    <span className="text-2xl">📅</span>
                    <div className="text-left flex-1">
                      <span className="font-medium text-sm block">Veckoplan</span>
                      <span className="text-xs text-gray-500">Planera veckans måltider</span>
                    </div>
                    <span className="text-gray-400">→</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Profile Summary Card - for established users */}
          {!needsOnboarding && (
            <div className="px-4 pb-5">
              <Link
                href="/profile"
                className="card p-4 flex items-center gap-4 active:scale-[0.98] transition-transform"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">Din smakprofil</p>
                  <p className="text-caption text-sm">
                    {ratingCount} betyg · Se preferenser
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Onboarding for non-logged in users */}
          <div className="px-6 pt-8 pb-6 text-center">
            <div className="text-5xl mb-3">🍽️</div>
            <h1 className="text-display mb-2">Kingdom Kitchen</h1>
            <p className="text-caption">
              Måltidsplaneraren för kräsna ätare
            </p>
          </div>

          <div className="px-4 pb-8">
            <div className="card p-6 text-center">
              <h2 className="text-title mb-6">Hur fungerar det?</h2>

              <div className="space-y-6">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">👆</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-0.5">1. Svajpa recept</h3>
                    <p className="text-caption text-sm">Betygsätt vad du och familjen gillar</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-left">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-0.5">2. Vi lär oss</h3>
                    <p className="text-caption text-sm">Appen förstår vad alla tycker om</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-left">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">✨</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-0.5">3. Perfekta förslag</h3>
                    <p className="text-caption text-sm">Recept hela familjen kommer älska</p>
                  </div>
                </div>
              </div>

              <Link
                href="/login"
                className="btn btn-primary w-full mt-8"
              >
                Kom igång gratis
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="px-4 pb-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <span className="text-2xl mb-2 block">🎯</span>
                <p className="font-medium text-sm">Personliga preferenser</p>
              </div>
              <div className="card p-4">
                <span className="text-2xl mb-2 block">👨‍👩‍👧‍👦</span>
                <p className="font-medium text-sm">Hela familjens smak</p>
              </div>
              <div className="card p-4">
                <span className="text-2xl mb-2 block">🇸🇪</span>
                <p className="font-medium text-sm">Svenska recept</p>
              </div>
              <div className="card p-4">
                <span className="text-2xl mb-2 block">📅</span>
                <p className="font-medium text-sm">Veckoplanering</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 10) return 'God morgon';
  if (hour < 12) return 'God förmiddag';
  if (hour < 17) return 'Hej';
  return 'God kväll';
}
