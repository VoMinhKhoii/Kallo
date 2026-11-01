/** Every food page's captured numbers, written by `scripts/seo/capture-food-page.ts`. */

import type { FoodSlug } from '../slugs';
import type { FoodPageCapture } from '../types';
import acaiBowl from './acai-bowl.json';
import avocadoToast from './avocado-toast.json';
import bagelWithCreamCheese from './bagel-with-cream-cheese.json';
import beefTacos from './beef-tacos.json';
import bibimbap from './bibimbap.json';
import breakfastBurrito from './breakfast-burrito.json';
import butterChicken from './butter-chicken.json';
import cheeseburger from './cheeseburger.json';
import chickenAlfredo from './chicken-alfredo.json';
import chickenAndRice from './chicken-and-rice.json';
import chickenBurrito from './chicken-burrito.json';
import chickenCaesarSalad from './chicken-caesar-salad.json';
import chickenFriedRice from './chicken-fried-rice.json';
import chickenNoodleSoup from './chicken-noodle-soup.json';
import chickenQuesadilla from './chicken-quesadilla.json';
import chickenShawarma from './chicken-shawarma.json';
import chickenStirFry from './chicken-stir-fry.json';
import chickenTeriyaki from './chicken-teriyaki.json';
import chickenTikkaMasala from './chicken-tikka-masala.json';
import chickenWings from './chicken-wings.json';
import chiliConCarne from './chili-con-carne.json';
import clubSandwich from './club-sandwich.json';
import cobbSalad from './cobb-salad.json';
import eggsBenedict from './eggs-benedict.json';
import falafelWrap from './falafel-wrap.json';
import fishAndChips from './fish-and-chips.json';
import frenchToast from './french-toast.json';
import friedChicken from './fried-chicken.json';
import friedChickenSandwich from './fried-chicken-sandwich.json';
import fullEnglishBreakfast from './full-english-breakfast.json';
import greekSalad from './greek-salad.json';
import greekYogurtParfait from './greek-yogurt-parfait.json';
import gyro from './gyro.json';
import hotDog from './hot-dog.json';
import lasagna from './lasagna.json';
import macAndCheese from './mac-and-cheese.json';
import margheritaPizza from './margherita-pizza.json';
import nachos from './nachos.json';
import oatmeal from './oatmeal.json';
import orangeChicken from './orange-chicken.json';
import padThai from './pad-thai.json';
import pancakes from './pancakes.json';
import pepperoniPizza from './pepperoni-pizza.json';
import pho from './pho.json';
import pokeBowl from './poke-bowl.json';
import ramen from './ramen.json';
import spaghettiBolognese from './spaghetti-bolognese.json';
import spaghettiCarbonara from './spaghetti-carbonara.json';
import sushiRolls from './sushi-rolls.json';
import thaiGreenCurry from './thai-green-curry.json';

export const CAPTURES: Record<FoodSlug, FoodPageCapture> = {
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
