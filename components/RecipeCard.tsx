'use client';

import { Recipe } from '@/lib/types';
import Image from 'next/image';

interface RecipeCardProps {
  recipe: Recipe;
  showScore?: boolean;
  score?: number;
  familyScores?: { [name: string]: number };
}

export function RecipeCard({ recipe, showScore, score, familyScores }: RecipeCardProps) {
  const totalTime = recipe.total_time_minutes || 
    ((recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0));
  
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-md mx-auto">
      {/* Image */}
      <div className="relative h-64 bg-gray-200">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.name}
            fill
            className="object-cover"
            unoptimized // External images
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <span className="text-6xl">🍽️</span>
          </div>
        )}
        
        {/* Time badge */}
        {totalTime > 0 && (
          <div className="absolute top-4 right-4 bg-white/90 rounded-full px-3 py-1 text-sm font-medium">
            ⏱️ {totalTime} min
          </div>
        )}
        
        {/* External rating badge */}
        {recipe.external_rating && (
          <div className="absolute top-4 left-4 bg-white/90 rounded-full px-3 py-1 text-sm font-medium">
            ⭐ {recipe.external_rating.toFixed(1)}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {recipe.name}
        </h2>
        
        {recipe.description && (
          <p className="text-gray-600 mb-4 line-clamp-2">
            {recipe.description}
          </p>
        )}
        
        {/* Features tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {recipe.features.cuisine && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {recipe.features.cuisine}
            </span>
          )}
          {recipe.features.protein?.map(p => (
            <span key={p} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              {p}
            </span>
          ))}
          {recipe.features.prep_time_bucket && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
              {recipe.features.prep_time_bucket}
            </span>
          )}
        </div>
        
        {/* Ingredients preview */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Ingredienser:</h3>
          <p className="text-gray-600 text-sm">
            {recipe.ingredients.slice(0, 5).map(i => i.ingredient).join(', ')}
            {recipe.ingredients.length > 5 && ` +${recipe.ingredients.length - 5} till`}
          </p>
        </div>
        
        {/* Scores (if showing suggestions) */}
        {showScore && (
          <div className="pt-4 border-t">
            {familyScores ? (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Family scores:</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(familyScores).map(([name, score]) => (
                    <span 
                      key={name}
                      className={`px-3 py-1 rounded-full text-sm ${
                        score > 0 
                          ? 'bg-green-100 text-green-800' 
                          : score < 0 
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {name}: {score > 0 ? '+' : ''}{score.toFixed(1)}
                    </span>
                  ))}
                </div>
              </div>
            ) : score !== undefined && (
              <div className="text-center">
                <span className={`text-lg font-bold ${
                  score > 0 ? 'text-green-600' : score < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  Match: {score > 0 ? '+' : ''}{score.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Source link */}
        <div className="mt-4 pt-4 border-t text-center">
          <a 
            href={recipe.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Se fullständigt recept →
          </a>
        </div>
      </div>
    </div>
  );
}
