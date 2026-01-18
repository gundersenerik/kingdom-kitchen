'use client';

import { useState } from 'react';
import { RatingValue } from '@/lib/types';

interface RatingButtonsProps {
  onRate: (rating: RatingValue, excludedIngredients?: string[]) => void;
  isLoading?: boolean;
  recipeIngredients?: string[];
}

export function RatingButtons({ onRate, isLoading, recipeIngredients }: RatingButtonsProps) {
  const [showExcludeModal, setShowExcludeModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState<RatingValue | null>(null);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  
  const handleRatingClick = (rating: RatingValue) => {
    if (rating === 'liked' || rating === 'neutral') {
      // These ratings might have "except for..." options
      setSelectedRating(rating);
      setShowExcludeModal(true);
    } else {
      // Direct ratings
      onRate(rating);
    }
  };
  
  const handleConfirmRating = () => {
    if (selectedRating) {
      onRate(selectedRating, excludedIngredients.length > 0 ? excludedIngredients : undefined);
    }
    setShowExcludeModal(false);
    setSelectedRating(null);
    setExcludedIngredients([]);
  };
  
  const toggleIngredient = (ingredient: string) => {
    setExcludedIngredients(prev => 
      prev.includes(ingredient)
        ? prev.filter(i => i !== ingredient)
        : [...prev, ingredient]
    );
  };
  
  return (
    <>
      {/* Main rating buttons */}
      <div className="flex justify-center items-center gap-4 py-6">
        {/* Hate */}
        <button
          onClick={() => handleRatingClick('hated')}
          disabled={isLoading}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white text-2xl shadow-lg transition-all hover:scale-110 disabled:opacity-50"
          title="Hatar det"
        >
          🤮
        </button>
        
        {/* Dislike */}
        <button
          onClick={() => handleRatingClick('disliked')}
          disabled={isLoading}
          className="w-14 h-14 rounded-full bg-orange-400 hover:bg-orange-500 text-white text-xl shadow-lg transition-all hover:scale-110 disabled:opacity-50"
          title="Gillar inte"
        >
          👎
        </button>
        
        {/* Neutral / Maybe */}
        <button
          onClick={() => handleRatingClick('neutral')}
          disabled={isLoading}
          className="w-12 h-12 rounded-full bg-gray-300 hover:bg-gray-400 text-gray-700 text-lg shadow-lg transition-all hover:scale-110 disabled:opacity-50"
          title="Kanske"
        >
          🤷
        </button>
        
        {/* Like */}
        <button
          onClick={() => handleRatingClick('liked')}
          disabled={isLoading}
          className="w-14 h-14 rounded-full bg-green-400 hover:bg-green-500 text-white text-xl shadow-lg transition-all hover:scale-110 disabled:opacity-50"
          title="Gillar det"
        >
          👍
        </button>
        
        {/* Love */}
        <button
          onClick={() => handleRatingClick('loved')}
          disabled={isLoading}
          className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 text-white text-2xl shadow-lg transition-all hover:scale-110 disabled:opacity-50"
          title="Älskar det!"
        >
          😍
        </button>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="text-center text-gray-500 animate-pulse">
          Sparar...
        </div>
      )}
      
      {/* Exclude ingredients modal */}
      {showExcludeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {selectedRating === 'liked' 
                ? 'Du gillar det! Något du vill undvika?' 
                : 'Kanske... Något specifikt du inte gillar?'}
            </h3>
            
            {recipeIngredients && recipeIngredients.length > 0 ? (
              <>
                <p className="text-gray-600 mb-4">
                  Markera ingredienser du vill undvika:
                </p>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {recipeIngredients.map(ingredient => (
                    <button
                      key={ingredient}
                      onClick={() => toggleIngredient(ingredient)}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        excludedIngredients.includes(ingredient)
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {ingredient}
                      {excludedIngredients.includes(ingredient) && ' ✕'}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-600 mb-6">
                Inga ingredienser att visa.
              </p>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowExcludeModal(false);
                  setSelectedRating(null);
                  setExcludedIngredients([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleConfirmRating}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                {excludedIngredients.length > 0 
                  ? `Spara (utan ${excludedIngredients.length} ingrediens${excludedIngredients.length > 1 ? 'er' : ''})` 
                  : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
