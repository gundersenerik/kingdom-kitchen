'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface Preference {
  feature: string;
  weight: number;
  sample_count: number;
}

interface TasteCategory {
  name: string;
  icon: string;
  features: { label: string; value: number }[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [ratingCount, setRatingCount] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      try {
        // Get profile info
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, display_name, household_id')
          .eq('user_id', session.user.id)
          .single();

        if (profile) {
          setDisplayName(profile.display_name);

          // Get rating count
          const { count } = await supabase
            .from('ratings')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id);

          setRatingCount(count || 0);

          // Get household invite code
          if (profile.household_id) {
            const { data: household } = await supabase
              .from('households')
              .select('invite_code')
              .eq('id', profile.household_id)
              .single();

            if (household?.invite_code) {
              setInviteCode(household.invite_code);
            }
          }
        }

        // Get preferences
        const prefsResponse = await fetch('/api/profile/preferences', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (prefsResponse.ok) {
          const data = await prefsResponse.json();
          setPreferences(data.preferences || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Categorize preferences for display
  const categorizePreferences = (): TasteCategory[] => {
    const categories: { [key: string]: TasteCategory } = {
      cuisine: { name: 'Kök', icon: '🌍', features: [] },
      protein: { name: 'Protein', icon: '🍖', features: [] },
      carb: { name: 'Kolhydrater', icon: '🍚', features: [] },
      cooking_method: { name: 'Matlagning', icon: '🍳', features: [] },
      ingredient: { name: 'Ingredienser', icon: '🥬', features: [] },
    };

    for (const pref of preferences) {
      const [type, value] = pref.feature.split(':');
      if (categories[type] && value) {
        categories[type].features.push({
          label: value,
          value: pref.weight,
        });
      }
    }

    // Sort features by absolute weight and limit
    for (const cat of Object.values(categories)) {
      cat.features.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      cat.features = cat.features.slice(0, 5);
    }

    return Object.values(categories).filter(c => c.features.length > 0);
  };

  // Get top likes and dislikes
  const likes = preferences
    .filter(p => p.weight > 0.2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  const dislikes = preferences
    .filter(p => p.weight < -0.2)
    .sort((a, b) => a.weight - b.weight)
    .slice(0, 6);

  const formatFeature = (feature: string) => {
    const [, value] = feature.split(':');
    return value || feature;
  };

  // Calculate taste dimensions for radar chart visualization
  const getTasteDimensions = () => {
    const dimensions = [
      { name: 'Köttälskare', key: 'protein:kyckling,protein:nötkött,protein:fläsk', icon: '🥩' },
      { name: 'Fiskfan', key: 'protein:fisk,protein:räkor,protein:lax', icon: '🐟' },
      { name: 'Vegetariskt', key: 'protein:tofu,protein:bönor,cuisine:vegetariskt', icon: '🥗' },
      { name: 'Snabblagat', key: 'prep_time_bucket:quick', icon: '⚡' },
      { name: 'Kryddigt', key: 'spice_level:hot,spice_level:medium', icon: '🌶️' },
      { name: 'Internationellt', key: 'cuisine:asiatiskt,cuisine:italienskt,cuisine:mexikanskt', icon: '🌎' },
    ];

    return dimensions.map(dim => {
      const keys = dim.key.split(',');
      let total = 0;
      let count = 0;

      for (const pref of preferences) {
        if (keys.some(k => pref.feature.includes(k.split(':')[1]))) {
          total += pref.weight;
          count++;
        }
      }

      const score = count > 0 ? Math.max(0, Math.min(100, 50 + (total / count) * 200)) : 50;

      return { ...dim, score };
    });
  };

  const tasteDimensions = getTasteDimensions();
  const tasteCategories = categorizePreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="safe-top pb-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-5">
        <div className="card card-elevated p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">👤</span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{displayName || 'Användare'}</h1>
              <p className="text-caption text-sm">{user?.email}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-green-600">{ratingCount}</p>
              <p className="text-xs text-gray-500">Betyg</p>
            </div>
            <div className="flex-1 text-center border-l border-gray-100">
              <p className="text-2xl font-bold text-green-600">{likes.length}</p>
              <p className="text-xs text-gray-500">Favoriter</p>
            </div>
            <div className="flex-1 text-center border-l border-gray-100">
              <p className="text-2xl font-bold text-orange-500">{dislikes.length}</p>
              <p className="text-xs text-gray-500">Undviker</p>
            </div>
          </div>
        </div>
      </div>

      {/* Taste Profile Visualization */}
      {preferences.length > 5 && (
        <div className="px-4 pb-5">
          <h2 className="font-semibold mb-3">Din smakprofil</h2>
          <div className="card p-4">
            <div className="grid grid-cols-2 gap-3">
              {tasteDimensions.map((dim, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xl">{dim.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{dim.name}</span>
                      <span className={`font-medium ${
                        dim.score > 60 ? 'text-green-600' : dim.score < 40 ? 'text-orange-500' : 'text-gray-400'
                      }`}>
                        {dim.score > 60 ? '👍' : dim.score < 40 ? '👎' : '—'}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dim.score > 60 ? 'bg-green-500' : dim.score < 40 ? 'bg-orange-400' : 'bg-gray-300'
                        }`}
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Likes & Dislikes */}
      {(likes.length > 0 || dislikes.length > 0) && (
        <div className="px-4 pb-5">
          <h2 className="font-semibold mb-3">Vad du gillar & undviker</h2>

          <div className="space-y-3">
            {/* Likes */}
            {likes.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm">❤️</span>
                  <h3 className="font-medium text-green-700">Favoriter</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {likes.map((pref, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm border border-green-200"
                    >
                      {formatFeature(pref.feature)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dislikes */}
            {dislikes.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-sm">🚫</span>
                  <h3 className="font-medium text-orange-700">Undviker</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dislikes.map((pref, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm border border-orange-200"
                    >
                      {formatFeature(pref.feature)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {preferences.length === 0 && (
        <div className="px-4 pb-5">
          <div className="card p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤔</span>
            </div>
            <h3 className="font-semibold mb-2">Ingen smakprofil ännu</h3>
            <p className="text-caption mb-4">
              Betygsätt recept så lär vi känna din smak
            </p>
            <button
              onClick={() => router.push('/rate')}
              className="btn btn-primary"
            >
              Börja betygsätta
            </button>
          </div>
        </div>
      )}

      {/* Family section */}
      <div className="px-4 pb-5">
        <h2 className="font-semibold mb-3">Familj</h2>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">👨‍👩‍👧‍👦</span>
              </div>
              <div>
                <p className="font-medium">Bjud in familjemedlem</p>
                <p className="text-caption text-sm">Dela så alla kan betygsätta</p>
              </div>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="btn btn-secondary text-sm py-2"
            >
              Bjud in
            </button>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="px-4 pb-5">
        <h2 className="font-semibold mb-3">Inställningar</h2>
        <div className="card overflow-hidden">
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">🔔</span>
              <span className="font-medium">Notifikationer</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
          <div className="border-t border-gray-100" />
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">🎨</span>
              <span className="font-medium">Utseende</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
          <div className="border-t border-gray-100" />
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">❓</span>
              <span className="font-medium">Hjälp & support</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>
      </div>

      {/* Sign out */}
      <div className="px-4 pb-8">
        <button
          onClick={handleSignOut}
          className="w-full p-4 text-red-500 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
        >
          Logga ut
        </button>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🔗</span>
              </div>
              <h2 className="text-lg font-bold">Bjud in till familjen</h2>
              <p className="text-caption text-sm mt-1">
                Dela denna kod med din familj
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
              <p className="text-2xl font-mono font-bold tracking-widest text-green-600">
                {inviteCode || 'ABC123'}
              </p>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteCode || 'ABC123');
              }}
              className="btn btn-primary w-full mb-3"
            >
              📋 Kopiera kod
            </button>

            <button
              onClick={() => setShowInvite(false)}
              className="btn btn-ghost w-full"
            >
              Stäng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
