#ifndef RATING_H
#define RATING_H

// Elo rating system
#define DEFAULT_RATING 1200
#define DEFAULT_K_FACTOR 32

typedef struct {
    int red_change;
    int black_change;
} rating_change_t;

// Calculate rating changes after a match
rating_change_t rating_calculate(int red_rating, int black_rating,
                                 const char* result, int k_factor);

// Expected score (probability of winning)
double rating_expected_score(int rating_a, int rating_b);

#endif  // RATING_H
