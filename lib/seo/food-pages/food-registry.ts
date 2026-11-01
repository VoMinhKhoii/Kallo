/** Every food page's meals and copy, by slug: one file per page under `foods/<group>/`. */

import { food as bibimbap } from './foods/asian/bibimbap';
import { food as chickenFriedRice } from './foods/asian/chicken-fried-rice';
import { food as chickenStirFry } from './foods/asian/chicken-stir-fry';
import { food as chickenTeriyaki } from './foods/asian/chicken-teriyaki';
import { food as orangeChicken } from './foods/asian/orange-chicken';
import { food as padThai } from './foods/asian/pad-thai';
import { food as pho } from './foods/asian/pho';
import { food as pokeBowl } from './foods/asian/poke-bowl';
import { food as ramen } from './foods/asian/ramen';
import { food as sushiRolls } from './foods/asian/sushi-rolls';
import { food as acaiBowl } from './foods/breakfast/acai-bowl';
import { food as avocadoToast } from './foods/breakfast/avocado-toast';
import { food as bagelWithCreamCheese } from './foods/breakfast/bagel-with-cream-cheese';
import { food as breakfastBurrito } from './foods/breakfast/breakfast-burrito';
import { food as eggsBenedict } from './foods/breakfast/eggs-benedict';
import { food as frenchToast } from './foods/breakfast/french-toast';
import { food as fullEnglishBreakfast } from './foods/breakfast/full-english-breakfast';
import { food as greekYogurtParfait } from './foods/breakfast/greek-yogurt-parfait';
import { food as oatmeal } from './foods/breakfast/oatmeal';
import { food as pancakes } from './foods/breakfast/pancakes';
import { food as chickenAndRice } from './foods/comfort/chicken-and-rice';
import { food as chickenNoodleSoup } from './foods/comfort/chicken-noodle-soup';
import { food as chickenWings } from './foods/comfort/chicken-wings';
import { food as fishAndChips } from './foods/comfort/fish-and-chips';
import { food as friedChicken } from './foods/comfort/fried-chicken';
import { food as butterChicken } from './foods/curries/butter-chicken';
import { food as chickenTikkaMasala } from './foods/curries/chicken-tikka-masala';
import { food as chiliConCarne } from './foods/curries/chili-con-carne';
import { food as thaiGreenCurry } from './foods/curries/thai-green-curry';
import { food as beefTacos } from './foods/mexican/beef-tacos';
import { food as chickenBurrito } from './foods/mexican/chicken-burrito';
import { food as chickenQuesadilla } from './foods/mexican/chicken-quesadilla';
import { food as nachos } from './foods/mexican/nachos';
import { food as chickenAlfredo } from './foods/pizza-pasta/chicken-alfredo';
import { food as lasagna } from './foods/pizza-pasta/lasagna';
import { food as macAndCheese } from './foods/pizza-pasta/mac-and-cheese';
import { food as margheritaPizza } from './foods/pizza-pasta/margherita-pizza';
import { food as pepperoniPizza } from './foods/pizza-pasta/pepperoni-pizza';
import { food as spaghettiBolognese } from './foods/pizza-pasta/spaghetti-bolognese';
import { food as spaghettiCarbonara } from './foods/pizza-pasta/spaghetti-carbonara';
import { food as chickenCaesarSalad } from './foods/salads/chicken-caesar-salad';
import { food as cobbSalad } from './foods/salads/cobb-salad';
import { food as greekSalad } from './foods/salads/greek-salad';
import { food as cheeseburger } from './foods/sandwiches/cheeseburger';
import { food as chickenShawarma } from './foods/sandwiches/chicken-shawarma';
import { food as clubSandwich } from './foods/sandwiches/club-sandwich';
import { food as falafelWrap } from './foods/sandwiches/falafel-wrap';
import { food as friedChickenSandwich } from './foods/sandwiches/fried-chicken-sandwich';
import { food as gyro } from './foods/sandwiches/gyro';
import { food as hotDog } from './foods/sandwiches/hot-dog';
import type { FoodSlug } from './slugs';
import type { FoodContent } from './types';

export const FOODS: Record<FoodSlug, FoodContent> = {
  'avocado-toast': avocadoToast,
  'eggs-benedict': eggsBenedict,
  pancakes: pancakes,
  'breakfast-burrito': breakfastBurrito,
  oatmeal: oatmeal,
  'acai-bowl': acaiBowl,
  'greek-yogurt-parfait': greekYogurtParfait,
  'french-toast': frenchToast,
  'bagel-with-cream-cheese': bagelWithCreamCheese,
  'full-english-breakfast': fullEnglishBreakfast,
  'chicken-shawarma': chickenShawarma,
  cheeseburger: cheeseburger,
  'fried-chicken-sandwich': friedChickenSandwich,
  'club-sandwich': clubSandwich,
  'hot-dog': hotDog,
  gyro: gyro,
  'falafel-wrap': falafelWrap,
  'chicken-burrito': chickenBurrito,
  'beef-tacos': beefTacos,
  'chicken-quesadilla': chickenQuesadilla,
  nachos: nachos,
  'spaghetti-bolognese': spaghettiBolognese,
  'pepperoni-pizza': pepperoniPizza,
  'margherita-pizza': margheritaPizza,
  'spaghetti-carbonara': spaghettiCarbonara,
  'chicken-alfredo': chickenAlfredo,
  lasagna: lasagna,
  'mac-and-cheese': macAndCheese,
  'poke-bowl': pokeBowl,
  'pad-thai': padThai,
  'sushi-rolls': sushiRolls,
  ramen: ramen,
  pho: pho,
  'chicken-fried-rice': chickenFriedRice,
  'chicken-stir-fry': chickenStirFry,
  bibimbap: bibimbap,
  'chicken-teriyaki': chickenTeriyaki,
  'orange-chicken': orangeChicken,
  'chicken-tikka-masala': chickenTikkaMasala,
  'butter-chicken': butterChicken,
  'thai-green-curry': thaiGreenCurry,
  'chili-con-carne': chiliConCarne,
  'chicken-caesar-salad': chickenCaesarSalad,
  'greek-salad': greekSalad,
  'cobb-salad': cobbSalad,
  'fish-and-chips': fishAndChips,
  'chicken-wings': chickenWings,
  'fried-chicken': friedChicken,
  'chicken-and-rice': chickenAndRice,
  'chicken-noodle-soup': chickenNoodleSoup,
};
