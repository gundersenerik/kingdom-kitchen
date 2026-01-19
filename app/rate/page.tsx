'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Recipe, RatingValue } from '@/lib/types';
import { SwipeCard } from '@/components/SwipeCard';

interface RatingHistory {
  recipe: Recipe;
  rating: RatingValue;
}

export default function RatePage() {
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [nextRecipe, setNextRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(false);
  const [ratingCount, setRatingCount] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [lastRating, setLastRating] = useState<RatingHistory | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Prefetch next recipe
  const prefetchNextRecipe = useCallback(async (excludeId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const url = excludeId
        ? `/api/recipes/next?exclude=${excludeId}`
        : '/api/recipes/next';

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        return data.recipe;
      }
    } catch (err) {
      console.error('Prefetch error:', err);
    }
    return null;
  }, []);

  // Fetch initial recipes
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      try {
        // Get current rating count
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', session.user.id)
          .single();

        if (profile) {
          const { count } = await supabase
            .from('ratings')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profile.id);
          setRatingCount(count || 0);
        }

        const response = await fetch('/api/recipes/next', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setRecipe(data.recipe);

          // Prefetch next one (exclude current)
          if (data.recipe) {
            const next = await prefetchNextRecipe(data.recipe.id);
            setNextRecipe(next);
          }
        }
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router, prefetchNextRecipe]);

  // Submit rating
  const submitRating = async (ratingValue: RatingValue, isUndo = false) => {
    if (!recipe || rating) return;

    setRating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Save for potential undo
      if (!isUndo) {
        setLastRating({ recipe, rating: ratingValue });
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 3000);
      }

      await fetch('/api/recipes/rate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipe_id: recipe.id,
          rating: ratingValue,
        }),
      });

      setRatingCount(prev => prev + 1);

      // Store the current recipe ID before moving on
      const currentRecipeId = recipe.id;

      // Move to next recipe IMMEDIATELY - don't wait for prefetch
      if (nextRecipe) {
        // We have a prefetched recipe - show it immediately
        const showNow = nextRecipe;
        setRecipe(showNow);
        setNextRecipe(null);

        // Prefetch another in the background (don't await)
        prefetchNextRecipe(showNow.id).then(next => {
          setNextRecipe(next);
        });
      } else {
        // No prefetched recipe - need to fetch one
        // Show loading state briefly while we get it
        const next = await prefetchNextRecipe(currentRecipeId);
        if (next) {
          setRecipe(next);
          // Prefetch another in the background
          prefetchNextRecipe(next.id).then(nextNext => {
            setNextRecipe(nextNext);
          });
        } else {
          setRecipe(null); // No more recipes
        }
      }

    } catch (err) {
      console.error('Rating error:', err);
    } finally {
      setRating(false);
    }
  };

  // Undo last rating
  const handleUndo = async () => {
    if (!lastRating) return;

    setShowUndoToast(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Delete the rating
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        await supabase
          .from('ratings')
          .delete()
          .eq('profile_id', profile.id)
          .eq('recipe_id', lastRating.recipe.id);
      }

      // Restore the recipe
      setNextRecipe(recipe);
      setRecipe(lastRating.recipe);
      setRatingCount(prev => Math.max(0, prev - 1));
      setLastRating(null);

    } catch (err) {
      console.error('Undo error:', err);
    }
  };

  // Swipe handlers
  const handleSwipeRight = () => submitRating('liked');
  const handleSwipeLeft = () => submitRating('disliked');

  // Get key ingredients to display
  const getKeyIngredients = (recipe: Recipe): string[] => {
    if (!recipe.ingredients) return [];
    return recipe.ingredients
      .slice(0, 4)
      .map(ing => ing.ingredient)
      .filter(Boolean);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
        <div className="spinner mb-4" />
        <p className="text-caption">Laddar recept...</p>
      </div>
    );
  }

  // No more recipes
  if (!recipe) {
    return (
      <div className="empty-state min-h-[80vh]">
        <div className="empty-state-icon">🎉</div>
        <h2 className="empty-state-title">Alla recept betygsatta!</h2>
        <p className="empty-state-text">
          Du har gått igenom alla tillgängliga recept. Kom tillbaka senare för nya!
        </p>
        <button
          onClick={() => router.push('/suggest')}
          className="btn btn-primary"
        >
          Se förslag
        </button>
      </div>
    );
  }

  const progress = Math.min(100, (ratingCount / 30) * 100);
  const keyIngredients = getKeyIngredients(recipe);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="safe-top px-4 pt-2 pb-2">
        {/* Progress bar - only show during onboarding */}
        {ratingCount < 30 && (
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-small">Bygger din smakprofil</span>
              <span className="text-small font-medium">{ratingCount}/30</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Session stats for established users */}
        {ratingCount >= 30 && (
          <div className="flex items-center justify-between">
            <span className="text-caption">Svajpa för att betygsätta</span>
            <span className="text-sm font-medium text-green-600">{ratingCount} betyg</span>
          </div>
        )}
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-2 relative">
        {/* Queue preview (next card) */}
        {nextRecipe && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 -z-10">
            <div className="recipe-card-container opacity-40 scale-[0.95] translate-y-2">
              <div className="recipe-card">
                {nextRecipe.image_url ? (
                  <div
                    className="recipe-card-image"
                    style={{
                      backgroundImage: `url(${nextRecipe.image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                ) : (
                  <div className="recipe-card-image bg-gradient-to-br from-green-400 to-green-600" />
                )}
                <div className="recipe-card-gradient" />
              </div>
            </div>
          </div>
        )}

        <SwipeCard
          recipe={recipe}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onTap={() => setShowDetail(true)}
        />

        {/* Ingredient chips */}
        {keyIngredients.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-3 px-4">
            {keyIngredients.map((ing, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-white rounded-full text-sm text-gray-600 shadow-sm border border-gray-100"
              >
                {ing}
              </span>
            ))}
          </div>
        )}

        {/* Hint text */}
        <p className="text-caption text-center mt-3 text-xs">
          Svajpa höger = gilla · Vänster = skippa · Tryck = detaljer
        </p>
      </div>

      {/* Rating buttons */}
      <div className="rating-buttons safe-bottom pt-2">
        <button
          onClick={() => submitRating('hated')}
          disabled={rating}
          className="rating-btn rating-btn-hate rating-btn-small"
          aria-label="Hatar"
        >
          🤮
        </button>

        <button
          onClick={() => submitRating('disliked')}
          disabled={rating}
          className="rating-btn rating-btn-dislike rating-btn-medium"
          aria-label="Gillar inte"
        >
          👎
        </button>

        <button
          onClick={() => submitRating('neutral')}
          disabled={rating}
          className="rating-btn rating-btn-neutral rating-btn-small"
          aria-label="Kanske"
        >
          🤷
        </button>

        <button
          onClick={() => submitRating('liked')}
          disabled={rating}
          className="rating-btn rating-btn-like rating-btn-medium"
          aria-label="Gillar"
        >
          👍
        </button>

        <button
          onClick={() => submitRating('loved')}
          disabled={rating}
          className="rating-btn rating-btn-love rating-btn-large animate-pulse-subtle"
          aria-label="Älskar"
        >
          😍
        </button>
      </div>

      {/* Undo toast */}
      {showUndoToast && lastRating && (
        <div className="fixed bottom-28 left-4 right-4 z-50 animate-slide-up">
          <div className="bg-gray-900 text-white rounded-xl p-3 flex items-center justify-between shadow-lg">
            <span className="text-sm">
              {getRatingEmoji(lastRating.rating)} {lastRating.recipe.name.slice(0, 20)}...
            </span>
            <button
              onClick={handleUndo}
              className="px-3 py-1 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
            >
              Ångra
            </button>
          </div>
        </div>
      )}

      {/* Recipe detail modal */}
      {showDetail && recipe && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-8">
              <h2 className="text-title mb-2">{recipe.name}</h2>

              {recipe.description && (
                <p className="text-body text-gray-600 mb-4">{recipe.description}</p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-6">
                {recipe.total_time_minutes && (
                  <span className="px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                    ⏱️ {recipe.total_time_minutes} min
                  </span>
                )}
                {recipe.servings && (
                  <span className="px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                    👥 {recipe.servings}
                  </span>
                )}
                {recipe.features?.cuisine && (
                  <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm capitalize">
                    {recipe.features.cuisine}
                  </span>
                )}
                {recipe.external_rating && (
                  <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    ⭐ {recipe.external_rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Ingredients */}
              <h3 className="font-semibold mb-3">Ingredienser</h3>
              <ul className="space-y-2 mb-6">
                {recipe.ingredients.map((ing, i) => (
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
              {recipe.instructions && recipe.instructions.length > 0 && (
                <>
                  <h3 className="font-semibold mb-3">Instruktioner</h3>
                  <ol className="space-y-3">
                    {recipe.instructions.map((step, i) => (
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
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDetail(false);
                    submitRating('disliked');
                  }}
                  className="btn btn-secondary"
                >
                  👎 Nej tack
                </button>
                <button
                  onClick={() => {
                    setShowDetail(false);
                    submitRating('loved');
                  }}
                  className="btn btn-primary"
                >
                  😍 Älskar det
                </button>
              </div>

              {/* Link to original */}
              <a
                href={recipe.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-green-600 mt-4 text-sm"
              >
                Se originalrecept →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRatingEmoji(rating: RatingValue): string {
  switch (rating) {
    case 'loved': return '😍';
    case 'liked': return '👍';
    case 'neutral': return '🤷';
    case 'disliked': return '👎';
    case 'hated': return '🤮';
  }
}
