import { classRoutes } from './class.js';
import { dailyRoutes } from './daily.js';
import { bookRoutes } from './books.js';
import { houseRoutes } from './house.js';
import { certRoutes } from './cert.js';
import { villageRoutes } from './village.js';
import { activityRoutes } from './activity.js';
import { museumRoutes } from './museum.js';
import { imageRoutes } from './images.js';
import { shopRoutes } from './shop.js';

// 단계가 늘면 여기에 라우트 묶음을 더한다.
export const routes = { ...classRoutes, ...dailyRoutes, ...bookRoutes, ...houseRoutes, ...certRoutes, ...villageRoutes, ...activityRoutes, ...museumRoutes, ...imageRoutes, ...shopRoutes };
