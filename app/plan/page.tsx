'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Recipe } from '@/lib/types';

const DAYS = [
  { id: 'monday', name: 'Måndag', short: 'Mån' },
  { id: 'tuesday', name: 'Tisdag', short: 'Tis' },
  { id: 'wednesday', name: 'Onsdag', short: 'Ons' },
  { id: 'thursday', name: 'Torsdag', short: 'Tor' },
  { id: 'friday', name: 'Fredag', short: 'Fre' },
  { id: 'saturday', name: 'Lördag', short: 'Lör' },
  { id: 'sunday', name: 'Söndag', short: 'Sön' },
];

interface MealSlot {
  recipeId?: string;
  recipe?: Recipe;
}

interface DayPlan {
  lunch?: MealSlot;
  dinner?: MealSlot;
}

interface WeekPlan {
  [dayId: string]: DayPlan;
}

function PlanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [weekPlan, setWeekPlan] = useState<WeekPlan>({});
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [recipeToAdd, setRecipeToAdd] = useState<Recipe | null>(null);

  // Get week dates - memoized to prevent recalculation
  const weekDates = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(today.getDate() + diff);

    return DAYS.map((day, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        ...day,
        date: date.getDate(),
        month: date.toLocaleDateString('sv-SE', { month: 'short' }),
        fullDate: date.toISOString().split('T')[0],
        isToday: date.toDateString() === today.toDateString(),
        isPast: date < new Date(new Date().setHours(0, 0, 0, 0)),
      };
    });
  }, []);

  // Set initial selected day to today
  useEffect(() => {
    const today = weekDates.find(d => d.isToday);
    setSelectedDay(today?.id || 'monday');
  }, [weekDates]);

  // Check for recipe to add from URL
  useEffect(() => {
    const addRecipeId = searchParams.get('add');
    if (addRecipeId) {
      fetchRecipeToAdd(addRecipeId);
    }
  }, [searchParams]);

  const fetchRecipeToAdd = async (recipeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: recipe } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (recipe) {
        setRecipeToAdd(recipe);
        setShowAddRecipe(true);
      }
    } catch (err) {
      console.error('Error fetching recipe:', err);
    }
  };

  // Load week plan
  useEffect(() => {
    const loadPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // For now, just use local state (would load from Supabase in production)
      setLoading(false);
    };

    loadPlan();
  }, [router]);

  // Scroll to today on load
  useEffect(() => {
    if (scrollRef.current && selectedDay) {
      const selectedElement = scrollRef.current.querySelector(`[data-day="${selectedDay}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [loading, selectedDay]);

  const addRecipeToSlot = (dayId: string, slot: 'lunch' | 'dinner', recipe: Recipe) => {
    setWeekPlan(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        [slot]: { recipeId: recipe.id, recipe },
      },
    }));
    setShowAddRecipe(false);
    setRecipeToAdd(null);
    // Clear URL param
    router.replace('/plan');
  };

  const removeRecipeFromSlot = (dayId: string, slot: 'lunch' | 'dinner') => {
    setWeekPlan(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        [slot]: undefined,
      },
    }));
  };

  const countPlannedMeals = () => {
    return Object.values(weekPlan).reduce((count, day) => {
      return count + (day.lunch?.recipe ? 1 : 0) + (day.dinner?.recipe ? 1 : 0);
    }, 0);
  };

  const selectedDayData = weekDates.find(d => d.id === selectedDay);
  const selectedDayPlan = weekPlan[selectedDay] || {};

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
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-title">Veckoplan</h1>
          <span className="text-sm text-green-600 font-medium">
            {countPlannedMeals()} måltider
          </span>
        </div>
        <p className="text-caption">Planera veckans middagar</p>
      </div>

      {/* Horizontal week scroller */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3"
      >
        {weekDates.map((day) => {
          const dayPlan = weekPlan[day.id] || {};
          const hasMeals = dayPlan.lunch?.recipe || dayPlan.dinner?.recipe;
          const isSelected = selectedDay === day.id;

          return (
            <button
              key={day.id}
              data-day={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`flex-shrink-0 w-16 py-3 rounded-2xl transition-all ${
                isSelected
                  ? 'bg-green-500 text-white shadow-lg scale-105'
                  : day.isToday
                    ? 'bg-green-100 text-green-800 border-2 border-green-300'
                    : day.isPast
                      ? 'bg-gray-50 text-gray-400'
                      : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <span className="text-xs font-medium block">{day.short}</span>
              <span className="text-xl font-bold block">{day.date}</span>
              {hasMeals && (
                <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${
                  isSelected ? 'bg-white' : 'bg-green-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day details */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">
            {selectedDayData?.name}
            {selectedDayData?.isToday && (
              <span className="ml-2 text-sm text-green-600 font-normal">Idag</span>
            )}
          </h2>
          <span className="text-sm text-gray-500">
            {selectedDayData?.date} {selectedDayData?.month}
          </span>
        </div>

        {/* Meal slots */}
        <div className="space-y-3">
          {/* Lunch */}
          <MealSlotCard
            label="Lunch"
            emoji="🥗"
            meal={selectedDayPlan.lunch}
            onAdd={() => router.push('/suggest')}
            onRemove={() => removeRecipeFromSlot(selectedDay, 'lunch')}
          />

          {/* Dinner */}
          <MealSlotCard
            label="Middag"
            emoji="🍽️"
            meal={selectedDayPlan.dinner}
            onAdd={() => router.push('/suggest')}
            onRemove={() => removeRecipeFromSlot(selectedDay, 'dinner')}
          />
        </div>
      </div>

      {/* Week overview */}
      <div className="px-4 pb-4">
        <h2 className="font-semibold mb-3">Veckans översikt</h2>
        <div className="card overflow-hidden">
          {weekDates.map((day, index) => {
            const dayPlan = weekPlan[day.id] || {};
            const isSelected = selectedDay === day.id;

            return (
              <button
                key={day.id}
                onClick={() => setSelectedDay(day.id)}
                className={`w-full p-3 flex items-center justify-between text-left transition-colors ${
                  isSelected ? 'bg-green-50' : ''
                } ${index !== weekDates.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold ${
                    day.isToday
                      ? 'bg-green-500 text-white'
                      : day.isPast
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {day.date}
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${day.isPast ? 'text-gray-400' : ''}`}>
                      {day.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dayPlan.lunch?.recipe || dayPlan.dinner?.recipe ? (
                        <span className="text-green-600">
                          {[dayPlan.lunch?.recipe?.name, dayPlan.dinner?.recipe?.name]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : (
                        'Inga måltider planerade'
                      )}
                    </p>
                  </div>
                </div>
                {(dayPlan.lunch?.recipe || dayPlan.dinner?.recipe) && (
                  <div className="flex">
                    {dayPlan.lunch?.recipe && <span className="text-sm">🥗</span>}
                    {dayPlan.dinner?.recipe && <span className="text-sm">🍽️</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate plan CTA */}
      <div className="px-4 pb-6">
        <button
          onClick={() => router.push('/suggest')}
          className="btn btn-primary w-full"
        >
          ✨ Hitta recept att lägga till
        </button>
      </div>

      {/* Add recipe modal */}
      {showAddRecipe && recipeToAdd && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in"
          onClick={() => {
            setShowAddRecipe(false);
            setRecipeToAdd(null);
            router.replace('/plan');
          }}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-h-[70vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-8">
              <h2 className="text-title mb-4">Lägg till i veckoplan</h2>

              {/* Recipe preview */}
              <div className="flex gap-3 mb-6 p-3 bg-gray-50 rounded-xl">
                {recipeToAdd.image_url ? (
                  <Image
                    src={recipeToAdd.image_url}
                    alt={recipeToAdd.name}
                    width={80}
                    height={60}
                    className="rounded-lg object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-20 h-15 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🍽️</span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{recipeToAdd.name}</h3>
                  <p className="text-sm text-gray-500">
                    {recipeToAdd.total_time_minutes && `${recipeToAdd.total_time_minutes} min`}
                  </p>
                </div>
              </div>

              {/* Day selection */}
              <h3 className="font-medium mb-3">Välj dag</h3>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {weekDates.filter(d => !d.isPast).map((day) => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.id)}
                    className={`py-2 rounded-xl text-center transition-all ${
                      selectedDay === day.id
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span className="text-xs block">{day.short}</span>
                    <span className="text-sm font-semibold">{day.date}</span>
                  </button>
                ))}
              </div>

              {/* Slot selection */}
              <h3 className="font-medium mb-3">Välj måltid</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => addRecipeToSlot(selectedDay, 'lunch', recipeToAdd)}
                  className="p-4 bg-gray-50 rounded-xl text-center hover:bg-green-50 transition-colors"
                >
                  <span className="text-2xl block mb-1">🥗</span>
                  <span className="font-medium">Lunch</span>
                </button>
                <button
                  onClick={() => addRecipeToSlot(selectedDay, 'dinner', recipeToAdd)}
                  className="p-4 bg-gray-50 rounded-xl text-center hover:bg-green-50 transition-colors"
                >
                  <span className="text-2xl block mb-1">🍽️</span>
                  <span className="font-medium">Middag</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Meal slot card component
function MealSlotCard({
  label,
  emoji,
  meal,
  onAdd,
  onRemove,
}: {
  label: string;
  emoji: string;
  meal?: MealSlot;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (meal?.recipe) {
    return (
      <div className="card p-3">
        <div className="flex items-center gap-3">
          {meal.recipe.image_url ? (
            <Image
              src={meal.recipe.image_url}
              alt={meal.recipe.name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-xl object-cover"
              unoptimized
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-green-100 flex items-center justify-center">
              <span className="text-2xl">{emoji}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="font-medium truncate">{meal.recipe.name}</p>
            {meal.recipe.total_time_minutes && (
              <p className="text-sm text-gray-500">⏱️ {meal.recipe.total_time_minutes} min</p>
            )}
          </div>
          <button
            onClick={onRemove}
            className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className="card p-4 w-full flex items-center gap-4 border-2 border-dashed border-gray-200 bg-gray-50/50 hover:border-green-300 hover:bg-green-50/50 transition-colors"
    >
      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
        <span className="text-2xl opacity-50">{emoji}</span>
      </div>
      <div className="flex-1 text-left">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-gray-500">Lägg till recept</p>
      </div>
      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-lg">
        +
      </div>
    </button>
  );
}

// Wrap with Suspense for useSearchParams
export default function PlanPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="spinner" />
      </div>
    }>
      <PlanPageContent />
    </Suspense>
  );
}
