'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { RecipeSuggestion, Recipe } from '@/lib/types';

type TimeFilter = 'all' | 'quick' | 'medium' | 'long';

export default function SuggestPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'family' | 'me'>('family');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSuggestion | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push('/login');
          return;
        }

        const response = await fetch(`/api/recipes/suggest?for=${viewMode}&limit=30`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Suggestions error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [router, viewMode]);

  // Filter suggestions by time
  const filteredSuggestions = suggestions.filter(s => {
    if (timeFilter === 'all') return true;
    const time = s.recipe.total_time_minutes || 0;
    if (timeFilter === 'quick') return time > 0 && time <= 30;
    if (timeFilter === 'medium') return time > 30 && time <= 60;
    if (timeFilter === 'long') return time > 60;
    return true;
  });

  // Split into hero and grid
  const heroSuggestion = filteredSuggestions[0];
  const gridSuggestions = filteredSuggestions.slice(1);

  // Generate explanation for why this recipe is suggested
  const getWhyText = (suggestion: RecipeSuggestion): string => {
    const recipe = suggestion.recipe;
    const features = recipe.features || {};
    const parts: string[] = [];

    if (features.cuisine) {
      parts.push(`${features.cuisine} mat`);
    }
    if (features.protein && features.protein.length > 0) {
      parts.push(features.protein[0]);
    }
    if (recipe.total_time_minutes) {
      if (recipe.total_time_minutes <= 30) parts.push('snabblagat');
      else if (recipe.total_time_minutes <= 45) parts.push('lagom tid');
    }

    if (suggestion.why) {
      return suggestion.why;
    }

    if (parts.length === 0) return 'Populärt recept';

    return `Baserat på: ${parts.slice(0, 3).join(', ')}`;
  };

  return (
    <div className="safe-top pb-4">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-title mb-3">Vad ska vi äta?</h1>

        {/* View mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          <button
            onClick={() => setViewMode('family')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'family'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            👨‍👩‍👧‍👦 Familjen
          </button>
          <button
            onClick={() => setViewMode('me')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'me'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            👤 Bara mig
          </button>
        </div>

        {/* Time filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: '🍽️ Alla', count: suggestions.length },
            { id: 'quick', label: '⚡ Snabbt', sublabel: '<30 min' },
            { id: 'medium', label: '⏱️ Lagom', sublabel: '30-60 min' },
            { id: 'long', label: '🍲 Helgmat', sublabel: '>60 min' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setTimeFilter(filter.id as TimeFilter)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-all ${
                timeFilter === filter.id
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="spinner mb-4" />
          <p className="text-caption">Letar efter perfekta recept...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredSuggestions.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🤔</div>
          <h2 className="empty-state-title">
            {suggestions.length === 0 ? 'Inga förslag ännu' : 'Inga recept matchar'}
          </h2>
          <p className="empty-state-text">
            {suggestions.length === 0
              ? viewMode === 'family'
                ? 'Alla i familjen behöver betygsätta fler recept'
                : 'Betygsätt fler recept så lär vi oss din smak'
              : 'Prova ett annat filter'}
          </p>
          {suggestions.length === 0 && (
            <button
              onClick={() => router.push('/rate')}
              className="btn btn-primary"
            >
              Betygsätt recept
            </button>
          )}
        </div>
      )}

      {/* Suggestions */}
      {!loading && filteredSuggestions.length > 0 && (
        <>
          {/* Hero card */}
          {heroSuggestion && (
            <div className="px-4 pb-4">
              <button
                onClick={() => setSelectedRecipe(heroSuggestion)}
                className="w-full card card-elevated overflow-hidden text-left active:scale-[0.99] transition-transform"
              >
                <div className="relative aspect-[16/10]">
                  {heroSuggestion.recipe.image_url ? (
                    <Image
                      src={heroSuggestion.recipe.image_url}
                      alt={heroSuggestion.recipe.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <span className="text-6xl">🍽️</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Top badge */}
                  <div className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <span>⭐</span> Toppförslag
                  </div>

                  {/* Family score */}
                  {heroSuggestion.family_score > 0 && (
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-lg">
                      <span className="font-semibold text-green-600">
                        {viewMode === 'family' ? '👨‍👩‍👧‍👦' : '👍'}{' '}
                        {Math.round(heroSuggestion.family_score * 10) / 10}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h2 className="text-xl font-bold mb-1">{heroSuggestion.recipe.name}</h2>

                    <div className="flex items-center gap-3 text-sm text-white/90 mb-2">
                      {heroSuggestion.recipe.total_time_minutes && (
                        <span>⏱️ {heroSuggestion.recipe.total_time_minutes} min</span>
                      )}
                      {heroSuggestion.recipe.features?.cuisine && (
                        <span className="capitalize">{heroSuggestion.recipe.features.cuisine}</span>
                      )}
                    </div>

                    {/* Why explanation */}
                    <p className="text-sm text-white/80 bg-white/10 px-3 py-1.5 rounded-lg inline-block">
                      💡 {getWhyText(heroSuggestion)}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Results count */}
          <div className="px-4 pb-2">
            <p className="text-caption">
              {filteredSuggestions.length} förslag
              {viewMode === 'family' ? ' för hela familjen' : ''}
              {timeFilter !== 'all' && ` (${getTimeLabel(timeFilter)})`}
            </p>
          </div>

          {/* Grid */}
          <div className="suggestion-grid px-4 pb-4">
            {gridSuggestions.map((suggestion) => (
              <button
                key={suggestion.recipe.id}
                onClick={() => setSelectedRecipe(suggestion)}
                className="suggestion-card text-left"
              >
                {suggestion.recipe.image_url ? (
                  <Image
                    src={suggestion.recipe.image_url}
                    alt={suggestion.recipe.name}
                    width={200}
                    height={150}
                    className="suggestion-card-image"
                    unoptimized
                  />
                ) : (
                  <div className="aspect-[4/3] bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                    <span className="text-4xl">🍽️</span>
                  </div>
                )}

                <div className="suggestion-card-content">
                  <h3 className="suggestion-card-title">
                    {suggestion.recipe.name}
                  </h3>

                  <div className="suggestion-card-meta">
                    {suggestion.recipe.total_time_minutes && (
                      <span>⏱️ {suggestion.recipe.total_time_minutes}m</span>
                    )}

                    {suggestion.family_score > 0 && (
                      <span className="family-score">
                        {viewMode === 'family' ? '👨‍👩‍👧‍👦' : '👍'}{' '}
                        {Math.round(suggestion.family_score * 10) / 10}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Recipe detail modal */}
      {selectedRecipe && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in"
          onClick={() => setSelectedRecipe(null)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Image */}
            {selectedRecipe.recipe.image_url && (
              <div className="relative aspect-video">
                <Image
                  src={selectedRecipe.recipe.image_url}
                  alt={selectedRecipe.recipe.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg"
                >
                  ✕
                </button>

                {/* Family scores overlay */}
                {viewMode === 'family' && Object.keys(selectedRecipe.individual_scores || {}).length > 1 && (
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-xl p-3 shadow-lg">
                    <p className="text-xs text-gray-500 mb-2">Familjens betyg:</p>
                    <div className="flex gap-3">
                      {Object.entries(selectedRecipe.individual_scores).map(([name, score]) => (
                        <div key={name} className="flex items-center gap-1">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-sm font-medium ${
                            score > 0 ? 'text-green-600' : score < 0 ? 'text-orange-500' : 'text-gray-500'
                          }`}>
                            {score > 0 ? '+' : ''}{Math.round(score * 10) / 10}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedRecipe.recipe.image_url && (
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
            )}

            <div className="px-5 pb-8 pt-4">
              <h2 className="text-title mb-2">{selectedRecipe.recipe.name}</h2>

              {/* Why explanation */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-green-800">
                  💡 {getWhyText(selectedRecipe)}
                </p>
              </div>

              {selectedRecipe.recipe.description && (
                <p className="text-body text-gray-600 mb-4">{selectedRecipe.recipe.description}</p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedRecipe.recipe.total_time_minutes && (
                  <span className="px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                    ⏱️ {selectedRecipe.recipe.total_time_minutes} min
                  </span>
                )}
                {selectedRecipe.recipe.servings && (
                  <span className="px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                    👥 {selectedRecipe.recipe.servings}
                  </span>
                )}
                {selectedRecipe.recipe.features?.cuisine && (
                  <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm capitalize">
                    {selectedRecipe.recipe.features.cuisine}
                  </span>
                )}
                {selectedRecipe.recipe.external_rating && (
                  <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    ⭐ {selectedRecipe.recipe.external_rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Ingredients */}
              <h3 className="font-semibold mb-3">Ingredienser</h3>
              <ul className="space-y-2 mb-6">
                {selectedRecipe.recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>
                      {ing.amount && <span className="font-medium">{ing.amount} </span>}
                      {ing.ingredient}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Instructions */}
              {selectedRecipe.recipe.instructions && selectedRecipe.recipe.instructions.length > 0 && (
                <>
                  <h3 className="font-semibold mb-3">Instruktioner</h3>
                  <ol className="space-y-3 mb-6">
                    {selectedRecipe.recipe.instructions.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {i + 1}
                        </span>
                        <span className="text-gray-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    router.push(`/plan?add=${selectedRecipe.recipe.id}`);
                  }}
                  className="btn btn-primary w-full"
                >
                  📅 Lägg till i veckoplan
                </button>
                <a
                  href={selectedRecipe.recipe.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary w-full"
                >
                  Se originalrecept →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeLabel(filter: TimeFilter): string {
  switch (filter) {
    case 'quick': return 'under 30 min';
    case 'medium': return '30-60 min';
    case 'long': return 'över 60 min';
    default: return '';
  }
}
