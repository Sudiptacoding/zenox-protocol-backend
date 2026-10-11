// import express from 'express';
// import { 
//   getTasksAndLeaderboard, 
//   createTask, 
//   submitTask, 
//   getAdminPendingData, 
//   reviewTask 
// } from '../controllers/taskController.js';

// const router = express.Router();

// router.get('/', getTasksAndLeaderboard);
// router.post('/create', createTask);
// router.post('/submit', submitTask);
// router.get('/admin/pending', getAdminPendingData);
// router.post('/admin/review', reviewTask);

// export default router;


import express from 'express';

import {
  getTasksAndLeaderboard,
  createTask,
  startTask,
  submitTask,
  claimDailyReward,
  sendRewardToAdmin,
  // getAdminPendingData,
  getAdminPending,
  reviewTask,
  reviewRewardClaim,
  getAdminStats
} from '../controllers/taskController.js';

const router = express.Router();

router.get('/', getTasksAndLeaderboard);
router.post('/create', createTask);
router.post('/start', startTask); // Add this route
router.post('/submit', submitTask);
router.post('/daily-reward', claimDailyReward);
router.post('/send-reward', sendRewardToAdmin);
// router.get('/admin/pending', getAdminPendingData);
router.get('/admin/pending', getAdminPending);
router.post('/admin/review', reviewTask);
router.post('/admin/review-claim', reviewRewardClaim);



// আগের রাউটগুলোর সাথে এটি যুক্ত করুন:
router.get('/admin/stats', getAdminStats);

export default router;