/** Every food page's meals and copy, by slug: one file per page in this folder. */

import type { FoodSlug } from '../slugs';
import type { FoodContent } from '../types';
import { food as acaiBowl } from './acai-bowl';
import { food as avocadoToast } from './avocado-toast';
import { food as bagelWithCreamCheese } from './bagel-with-cream-cheese';
import { food as beefTacos } from './beef-tacos';
import { food as bibimbap } from './bibimbap';
import { food as breakfastBurrito } from './breakfast-burrito';
import { food as butterChicken } from './butter-chicken';
import { food as cheeseburger } from './cheeseburger';
import { food as chickenAlfredo } from './chicken-alfredo';
import { food as chickenAndRice } from './chicken-and-rice';
import { food as chickenBurrito } from './chicken-burrito';
import { food as chickenCaesarSalad } from './chicken-caesar-salad';
import { food as chickenFriedRice } from './chicken-fried-rice';
import { food as chickenNoodleSoup } from './chicken-noodle-soup';
import { food as chickenQuesadilla } from './chicken-quesadilla';
import { food as chickenShawarma } from './chicken-shawarma';
import { food as chickenStirFry } from './chicken-stir-fry';
import { food as chickenTeriyaki } from './chicken-teriyaki';
import { food as chickenTikkaMasala } from './chicken-tikka-masala';
import { food as chickenWings } from './chicken-wings';
import { food as chiliConCarne } from './chili-con-carne';
import { food as clubSandwich } from './club-sandwich';
import { food as cobbSalad } from './cobb-salad';
import { food as eggsBenedict } from './eggs-benedict';
import { food as falafelWrap } from './falafel-wrap';
import { food as fishAndChips } from './fish-and-chips';
import { food as frenchToast } from './french-toast';
import { food as friedChicken } from './fried-chicken';
import { food as friedChickenSandwich } from './fried-chicken-sandwich';
import { food as fullEnglishBreakfast } from './full-english-breakfast';
import { food as greekSalad } from './greek-salad';
import { food as greekYogurtParfait } from './greek-yogurt-parfait';
import { food as gyro } from './gyro';
import { food as hotDog } from './hot-dog';
import { food as lasagna } from './lasagna';
import { food as macAndCheese } from './mac-and-cheese';
import { food as margheritaPizza } from './margherita-pizza';
import { food as nachos } from './nachos';
import { food as oatmeal } from './oatmeal';
import { food as orangeChicken } from './orange-chicken';
import { food as padThai } from './pad-thai';
import { food as pancakes } from './pancakes';
import { food as pepperoniPizza } from './pepperoni-pizza';
import { food as pho } from './pho';
import { food as pokeBowl } from './poke-bowl';
import { food as ramen } from './ramen';
import { food as spaghettiBolognese } from './spaghetti-bolognese';
import { food as spaghettiCarbonara } from './spaghetti-carbonara';
import { food as sushiRolls } from './sushi-rolls';
import { food as thaiGreenCurry } from './thai-green-curry';

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
