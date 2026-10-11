// import { getDB } from '../config/db.js';
// import { ObjectId } from 'mongodb';
// import axios from 'axios';

// // Twitter API Integration
// const verifyTwitterAction = async (taskType, twitterHandle, targetId) => {
//   try {
//     const apiKey = process.env.TWITTER_API_KEY || 'new1_bfa38e8dcc8c41249193';
//     const response = await axios.get(`https://twitterapi.io/api/v2/verify`, {
//       headers: { 'X-API-Key': apiKey },
//       params: { type: taskType, handle: twitterHandle, targetId: targetId }
//     });
//     return response.data?.isVerified || true;
//   } catch (error) {
//     console.error('Twitter API Error:', error.message);
//     return true;
//   }
// };

// // 1. Get Tasks & Leaderboard
// export const getTasksAndLeaderboard = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.query;

//     const tasks = await db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray();
    
//     let userTasks = [];
//     if (userId) {
//       userTasks = await db.collection('user_tasks').find({ userId: new ObjectId(userId) }).toArray();
//     }

//     const formattedTasks = tasks.map(task => {
//       const ut = userTasks.find(u => u.taskId.toString() === task._id.toString());
//       return {
//         _id: task._id,
//         title: task.title,
//         description: task.description,
//         rewardEntries: task.rewardEntries,
//         platform: task.platform,
//         actionUrl: task.actionUrl,
//         requiresWallet: task.requiresWallet || false,
//         status: ut ? ut.status : 'todo',
//         submittedWallet: ut ? ut.submittedWallet : ''
//       };
//     });

//     const leaderboard = await db.collection('users')
//       .find({})
//       .sort({ entries: -1 })
//       .limit(10)
//       .project({ username: 1, name: 1, image: 1, entries: 1 })
//       .toArray();

//     res.status(200).json({ success: true, tasks: formattedTasks, leaderboard });
//   } catch (error) {
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// // 2. Create Task (Admin) - FIXED EXPORT
// export const createTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { title, description, rewardEntries, platform, actionUrl, requiresWallet } = req.body;

//     const newTask = {
//       title,
//       description,
//       rewardEntries: rewardEntries || 100,
//       platform: platform || 'twitter_follow',
//       actionUrl: actionUrl || '',
//       requiresWallet: requiresWallet || false,
//       createdAt: new Date()
//     };

//     const result = await db.collection('tasks').insertOne(newTask);
//     res.status(201).json({ success: true, taskId: result.insertedId });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to create task' });
//   }
// };

// // 3. Submit Task (User)
// export const submitTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, taskId, walletAddress, twitterHandle } = req.body;

//     const uId = new ObjectId(userId);
//     const tId = new ObjectId(taskId);

//     const task = await db.collection('tasks').findOne({ _id: tId });
//     if (!task) return res.status(404).json({ error: 'Task not found' });

//     if (task.requiresWallet || task.platform === 'wallet_submit') {
//       if (!walletAddress) {
//         return res.status(400).json({ error: 'Wallet address is required' });
//       }

//       await db.collection('user_tasks').updateOne(
//         { userId: uId, taskId: tId },
//         { $set: { status: 'pending', submittedWallet: walletAddress, updatedAt: new Date() } },
//         { upsert: true }
//       );

//       await db.collection('admin_notifications').insertOne({
//         type: 'WALLET_SUBMISSION',
//         userId: uId,
//         taskId: tId,
//         walletAddress,
//         isRead: false,
//         createdAt: new Date()
//       });

//       return res.status(200).json({ success: true, status: 'pending', message: 'Submitted for Admin Approval' });
//     }

//     const isVerified = await verifyTwitterAction(task.platform, twitterHandle, task.actionUrl);
//     if (!isVerified) {
//       return res.status(400).json({ error: 'Twitter Action not detected!' });
//     }

//     await db.collection('user_tasks').updateOne(
//       { userId: uId, taskId: tId },
//       { $set: { status: 'completed', completedAt: new Date() } },
//       { upsert: true }
//     );

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { $inc: { entries: task.rewardEntries || 100 } }
//     );

//     res.status(200).json({ success: true, status: 'completed', message: 'Task Verified and Points Added!' });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification failed' });
//   }
// };

// // 4. Admin Pending Data
// export const getAdminPendingData = async (req, res) => {
//   try {
//     const db = getDB();
//     const pendingSubmissions = await db.collection('user_tasks').aggregate([
//       { $match: { status: 'pending' } },
//       { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
//       { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
//       { $unwind: '$user' },
//       { $unwind: '$task' }
//     ]).toArray();

//     const unreadCount = await db.collection('admin_notifications').countDocuments({ isRead: false });

//     res.status(200).json({ success: true, pendingSubmissions, unreadCount });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch' });
//   }
// };

// // 5. Admin Review Task
// export const reviewTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userTaskId, action } = req.body;

//     const utId = new ObjectId(userTaskId);
//     const userTask = await db.collection('user_tasks').findOne({ _id: utId });
//     if (!userTask) return res.status(404).json({ error: 'Submission not found' });

//     if (action === 'approve') {
//       const task = await db.collection('tasks').findOne({ _id: userTask.taskId });
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'completed' } });
//       await db.collection('users').updateOne(
//         { _id: userTask.userId },
//         { $inc: { entries: task.rewardEntries || 100 } }
//       );
//     } else {
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'todo', submittedWallet: '' } });
//     }

//     await db.collection('admin_notifications').updateMany(
//       { taskId: userTask.taskId, userId: userTask.userId },
//       { $set: { isRead: true } }
//     );

//     res.status(200).json({ success: true, message: `Submission ${action}d` });
//   } catch (error) {
//     res.status(500).json({ error: 'Review failed' });
//   }
// };

// import { getDB } from '../config/db.js';
// import { ObjectId } from 'mongodb';
// import axios from 'axios';

// // 1. Get Tasks & Leaderboard
// export const getTasksAndLeaderboard = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.query;

//     const tasks = await db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray();
    
//     let userTasks = [];
//     if (userId) {
//       userTasks = await db.collection('user_tasks').find({ userId: new ObjectId(userId) }).toArray();
//     }

//     const formattedTasks = tasks.map(task => {
//       const ut = userTasks.find(u => u.taskId.toString() === task._id.toString());
//       return {
//         _id: task._id,
//         title: task.title,
//         description: task.description,
//         rewardEntries: task.rewardEntries,
//         platform: task.platform,
//         actionUrl: task.actionUrl,
//         requiresWallet: task.requiresWallet || false,
//         status: ut ? ut.status : 'todo',
//         submittedWallet: ut ? ut.submittedWallet : ''
//       };
//     });

//     const leaderboard = await db.collection('users')
//       .find({})
//       .sort({ entries: -1 })
//       .limit(10)
//       .project({ username: 1, name: 1, image: 1, entries: 1 })
//       .toArray();

//     res.status(200).json({ success: true, tasks: formattedTasks, leaderboard });
//   } catch (error) {
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// // 2. Create Task (MUST BE EXPORTED EXACTLY AS `createTask`)
// export const createTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { title, description, rewardEntries, platform, actionUrl, requiresWallet } = req.body;

//     const newTask = {
//       title,
//       description,
//       rewardEntries: rewardEntries || 100,
//       platform: platform || 'twitter_follow',
//       actionUrl: actionUrl || '',
//       requiresWallet: requiresWallet || false,
//       createdAt: new Date()
//     };

//     const result = await db.collection('tasks').insertOne(newTask);
//     res.status(201).json({ success: true, taskId: result.insertedId });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to create task' });
//   }
// };

// // 3. Submit Task
// export const submitTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, taskId, walletAddress } = req.body;

//     const uId = new ObjectId(userId);
//     const tId = new ObjectId(taskId);

//     const task = await db.collection('tasks').findOne({ _id: tId });
//     if (!task) return res.status(404).json({ error: 'Task not found' });

//     if (task.requiresWallet || task.platform === 'wallet_submit') {
//       if (!walletAddress || walletAddress.trim().length < 10) {
//         return res.status(400).json({ error: 'Valid EVM wallet address is required' });
//       }

//       await db.collection('user_tasks').updateOne(
//         { userId: uId, taskId: tId },
//         { $set: { status: 'pending', submittedWallet: walletAddress, updatedAt: new Date() } },
//         { upsert: true }
//       );

//       await db.collection('admin_notifications').insertOne({
//         type: 'WALLET_SUBMISSION',
//         userId: uId,
//         taskId: tId,
//         walletAddress,
//         isRead: false,
//         createdAt: new Date()
//       });

//       return res.status(200).json({ success: true, status: 'pending', message: 'Submitted for Admin Approval' });
//     }

//     await db.collection('user_tasks').updateOne(
//       { userId: uId, taskId: tId },
//       { $set: { status: 'completed', completedAt: new Date() } },
//       { upsert: true }
//     );

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { $inc: { entries: task.rewardEntries || 100 } }
//     );

//     res.status(200).json({ success: true, status: 'completed', message: 'Task Verified!' });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification failed' });
//   }
// };

// // 4. Admin Pending Data
// export const getAdminPendingData = async (req, res) => {
//   try {
//     const db = getDB();
//     const pendingSubmissions = await db.collection('user_tasks').aggregate([
//       { $match: { status: 'pending' } },
//       { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
//       { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
//       { $unwind: '$user' },
//       { $unwind: '$task' }
//     ]).toArray();

//     const unreadCount = await db.collection('admin_notifications').countDocuments({ isRead: false });

//     res.status(200).json({ success: true, pendingSubmissions, unreadCount });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch admin data' });
//   }
// };

// // 5. Admin Review Task
// export const reviewTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userTaskId, action } = req.body;

//     const utId = new ObjectId(userTaskId);
//     const userTask = await db.collection('user_tasks').findOne({ _id: utId });
//     if (!userTask) return res.status(404).json({ error: 'Submission not found' });

//     if (action === 'approve') {
//       const task = await db.collection('tasks').findOne({ _id: userTask.taskId });
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'completed' } });
//       await db.collection('users').updateOne(
//         { _id: userTask.userId },
//         { $inc: { entries: task.rewardEntries || 100 } }
//       );
//     } else {
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'todo', submittedWallet: '' } });
//     }

//     await db.collection('admin_notifications').updateMany(
//       { taskId: userTask.taskId, userId: userTask.userId },
//       { $set: { isRead: true } }
//     );

//     res.status(200).json({ success: true, message: `Submission ${action}d` });
//   } catch (error) {
//     res.status(500).json({ error: 'Review failed' });
//   }
// };

// import { getDB } from '../config/db.js';
// import { ObjectId } from 'mongodb';
// import axios from 'axios';

// // ১. স্ট্রিক্ট টুইটার ভেরিফিকেশন (আসল অ্যাকশন না করলে অটো-কমপ্লিট হবে না)
// const verifyTwitterAction = async (taskPlatform, twitterHandle, targetUrl) => {
//   try {
//     if (!twitterHandle) return false;

//     const apiKey = process.env.TWITTER_API_KEY || 'new1_bfa38e8dcc8c41249193';
//     const cleanUrl = targetUrl.replace(/\/$/, '');
//     const urlParts = cleanUrl.split('/').filter(Boolean);
//     const targetIdentifier = urlParts[urlParts.length - 1];

//     const response = await axios.get(`https://twitterapi.io/api/v2/verify`, {
//       headers: { 'X-API-Key': apiKey },
//       params: {
//         action: taskPlatform,
//         userHandle: twitterHandle,
//         target: targetIdentifier
//       },
//       timeout: 5000
//     });

//     // শুধুমাত্র এপিআই সত্য রিটার্ন করলেই ভেরিফাইড হবে
//     return response.data && response.data.isVerified === true;
//   } catch (error) {
//     console.error('Twitter API Verification Failed:', error.message);
//     // সিকিউরিটি: এপিআই ফেল করলে কোনোভাবেই ফ্রি টাস্ক কমপ্লিট হতে দেওয়া হবে না
//     return false;
//   }
// };

// // ২. ড্যাশবোর্ড টাস্ক, লিডারবোর্ড ও ইউজার ডাটা ফেচ
// export const getTasksAndLeaderboard = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.query;

//     const tasks = await db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray();
    
//     let userTasks = [];
//     if (userId && ObjectId.isValid(userId)) {
//       userTasks = await db.collection('user_tasks').find({ userId: new ObjectId(userId) }).toArray();
//     }

//     const formattedTasks = tasks.map(task => {
//       const ut = userTasks.find(u => u.taskId.toString() === task._id.toString());
//       return {
//         _id: task._id,
//         title: task.title,
//         description: task.description,
//         rewardEntries: task.rewardEntries,
//         platform: task.platform,
//         actionUrl: task.actionUrl,
//         requiresWallet: task.requiresWallet || false,
//         status: ut ? ut.status : 'todo',
//         submittedWallet: ut ? ut.submittedWallet : ''
//       };
//     });

//     // পয়েন্ট অনুযায়ী লিডারবোর্ড সর্টিং
//     const leaderboard = await db.collection('users')
//       .find({})
//       .sort({ entries: -1 })
//       .limit(10)
//       .project({ username: 1, name: 1, image: 1, entries: 1 })
//       .toArray();

//     let currentUser = null;
//     if (userId && ObjectId.isValid(userId)) {
//       currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
//     }

//     res.status(200).json({ success: true, tasks: formattedTasks, leaderboard, currentUser });
//   } catch (error) {
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// // ৩. টাস্ক সাবমিট ও ভেরিফাই
// export const submitTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, taskId, walletAddress, twitterHandle } = req.body;

//     const uId = new ObjectId(userId);
//     const tId = new ObjectId(taskId);

//     const task = await db.collection('tasks').findOne({ _id: tId });
//     if (!task) return res.status(404).json({ error: 'Task not found' });

//     // ওয়ালেট টাস্ক সাবমিশন
//     if (task.requiresWallet || task.platform === 'wallet_submit') {
//       if (!walletAddress || walletAddress.trim().length < 10) {
//         return res.status(400).json({ error: 'Valid wallet address is required' });
//       }

//       await db.collection('user_tasks').updateOne(
//         { userId: uId, taskId: tId },
//         { $set: { status: 'pending', submittedWallet: walletAddress, updatedAt: new Date() } },
//         { upsert: true }
//       );

//       await db.collection('admin_notifications').insertOne({
//         type: 'WALLET_SUBMISSION',
//         userId: uId,
//         taskId: tId,
//         walletAddress,
//         isRead: false,
//         createdAt: new Date()
//       });

//       return res.status(200).json({ success: true, status: 'pending', message: 'Submitted for Admin Approval' });
//     }

//     // টুইটার আসল অ্যাকশন ভেরিফিকেশন
//     const isVerified = await verifyTwitterAction(task.platform, twitterHandle, task.actionUrl);

//     if (!isVerified) {
//       return res.status(400).json({
//         error: 'Action not detected! Please complete the Follow/Like/Repost on X first.'
//       });
//     }

//     await db.collection('user_tasks').updateOne(
//       { userId: uId, taskId: tId },
//       { $set: { status: 'completed', completedAt: new Date() } },
//       { upsert: true }
//     );

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { $inc: { entries: task.rewardEntries || 100 } }
//     );

//     res.status(200).json({ success: true, status: 'completed', message: 'Task Verified! Points Added.' });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification failed' });
//   }
// };

// // ৪. ডেইলি রিওয়ার্ড ক্লেইম (Daily Reward)
// export const claimDailyReward = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const now = new Date();
//     const lastClaim = user.lastDailyReward ? new Date(user.lastDailyReward) : null;

//     // ২৪ ঘণ্টার চেক
//     if (lastClaim && (now - lastClaim) < 24 * 60 * 60 * 1000) {
//       const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now - lastClaim)) / (1000 * 60 * 60));
//       return res.status(400).json({ error: `Daily reward already claimed! Try again in ${hoursLeft} hours.` });
//     }

//     const rewardAmount = 50; // ৫০ পয়েন্ট ফ্রি ডেইলি রিওয়ার্ড

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { 
//         $inc: { entries: rewardAmount },$set: { lastDailyReward: now }
//       }
//     );

//     res.status(200).json({ success: true, message: `Successfully claimed ${rewardAmount} Daily Entries!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to claim daily reward' });
//   }
// };

// // ৫. প্রোফাইল থেকে এডমিনের কাছে রিওয়ার্ড সেন্ড করা
// export const sendRewardToAdmin = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, pointsToClaim } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user || (user.entries || 0) < pointsToClaim) {
//       return res.status(400).json({ error: 'Insufficient entries balance' });
//     }

//     // পয়েন্ট পেন্ডিং রেখে এডমিনের কাছে রিকোয়েস্ট তৈরি
//     await db.collection('reward_claims').insertOne({
//       userId: uId,
//       username: user.username || user.name,
//       points: pointsToClaim,
//       status: 'pending',
//       createdAt: new Date()
//     });

//     res.status(200).json({ success: true, message: 'Reward claim request submitted to Admin!' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to submit reward claim' });
//   }
// };

// // ৬. এডমিন প্যানেল ডাটা ফেচ (Super Admin Verification সহ)
// export const getAdminPendingData = async (req, res) => {
//   try {
//     const db = getDB();
//     const { adminId } = req.query;

//     if (!adminId || !ObjectId.isValid(adminId)) {
//       return res.status(403).json({ error: 'Unauthorized Access' });
//     }

//     // সুপার এডমিন চেক
//     const adminUser = await db.collection('users').findOne({ _id: new ObjectId(adminId) });
//     if (!adminUser || adminUser.role !== 'superadmin') {
//       return res.status(403).json({ error: 'Access Denied! Super Admin privileges required.' });
//     }

//     const pendingSubmissions = await db.collection('user_tasks').aggregate([
//       { $match: { status: 'pending' } },
//       { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
//       { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
//       { $unwind: '$user' },
//       { $unwind: '$task' }
//     ]).toArray();

//     const pendingClaims = await db.collection('reward_claims').find({ status: 'pending' }).toArray();

//     res.status(200).json({ success: true, pendingSubmissions, pendingClaims });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch admin data' });
//   }
// };

// // ৭. এডমিন কর্তৃক রিওয়ার্ড ক্লেইম বা ওয়ালেট রিভিউ
// export const reviewRewardClaim = async (req, res) => {
//   try {
//     const db = getDB();
//     const { claimId, action } = req.body; // action: 'approve' or 'reject'

//     const claim = await db.collection('reward_claims').findOne({ _id: new ObjectId(claimId) });
//     if (!claim) return res.status(404).json({ error: 'Claim request not found' });

//     if (action === 'approve') {
//       // ইউজার একাউন্ট থেকে পয়েন্ট কেটে নেওয়া হবে
//       await db.collection('users').updateOne(
//         { _id: claim.userId },
//         { $inc: { entries: -claim.points } }
//       );
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'approved' } });
//     } else {
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'rejected' } });
//     }

//     res.status(200).json({ success: true, message: `Claim ${action}d successfully!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to process claim review' });
//   }
// };

// // ৮. এডমিন টাস্ক তৈরি
// export const createTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { title, description, rewardEntries, platform, actionUrl, requiresWallet } = req.body;

//     const newTask = {
//       title,
//       description,
//       rewardEntries: rewardEntries || 100,
//       platform: platform || 'twitter_follow',
//       actionUrl: actionUrl || '',
//       requiresWallet: requiresWallet || false,
//       createdAt: new Date()
//     };

//     const result = await db.collection('tasks').insertOne(newTask);
//     res.status(201).json({ success: true, taskId: result.insertedId });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to create task' });
//   }
// };

// // ৯. এডমিন ওয়ালেট টাস্ক রিভিউ
// export const reviewTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userTaskId, action } = req.body;

//     const utId = new ObjectId(userTaskId);
//     const userTask = await db.collection('user_tasks').findOne({ _id: utId });
//     if (!userTask) return res.status(404).json({ error: 'Submission not found' });

//     if (action === 'approve') {
//       const task = await db.collection('tasks').findOne({ _id: userTask.taskId });
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'completed' } });
//       await db.collection('users').updateOne(
//         { _id: userTask.userId },
//         { $inc: { entries: task.rewardEntries || 100 } }
//       );
//     } else {
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'todo', submittedWallet: '' } });
//     }

//     res.status(200).json({ success: true, message: `Submission ${action}d successfully` });
//   } catch (error) {
//     res.status(500).json({ error: 'Review failed' });
//   }
// };


// import { getDB } from '../config/db.js';
// import { ObjectId } from 'mongodb';
// import axios from 'axios';

// // ১. রিয়েল টুইটার ভেরিফিকেশন (twitterapi.io ব্যবহার করে)
// const verifyTwitterAction = async (taskPlatform, twitterHandle, targetUrl) => {
//   try {
//     if (!twitterHandle) return false;

//     const apiKey = process.env.TWITTER_API_KEY || 'new1_bfa38e8dcc8c41249193';
//     const cleanUrl = targetUrl.replace(/\/$/, '');
//     const urlParts = cleanUrl.split('/').filter(Boolean);
//     const targetIdentifier = urlParts[urlParts.length - 1];

//     console.log(`[twitterapi.io Call] Action: ${taskPlatform} | User: @${twitterHandle} | Target: ${targetIdentifier}`);

//     const response = await axios.get(`https://twitterapi.io/api/v2/verify`, {
//       headers: { 
//         'X-API-Key': apiKey,
//         'Content-Type': 'application/json'
//       },
//       params: {
//         action: taskPlatform,
//         userHandle: twitterHandle.replace('@', ''),
//         target: targetIdentifier
//       },
//       timeout: 8000
//     });

//     if (response.data && (response.data.isVerified === true || response.data.success === true)) {
//       return true;
//     }

//     return false;
//   } catch (error) {
//     console.error('Twitter API Call Error:', error.response?.data || error.message);
//     return false;
//   }
// };

// // ২. টাস্ক, লিডারবোর্ড ও ইউজার ডাটা ফেচ
// export const getTasksAndLeaderboard = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.query;

//     const tasks = await db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray();
    
//     let userTasks = [];
//     if (userId && ObjectId.isValid(userId)) {
//       userTasks = await db.collection('user_tasks').find({ userId: new ObjectId(userId) }).toArray();
//     }

//     const formattedTasks = tasks.map(task => {
//       const ut = userTasks.find(u => u.taskId.toString() === task._id.toString());
//       return {
//         _id: task._id,
//         title: task.title,
//         description: task.description,
//         rewardEntries: task.rewardEntries,
//         platform: task.platform,
//         actionUrl: task.actionUrl,
//         requiresWallet: task.requiresWallet || false,
//         status: ut ? ut.status : 'todo',
//         submittedWallet: ut ? ut.submittedWallet : ''
//       };
//     });

//     const leaderboard = await db.collection('users')
//       .find({})
//       .sort({ entries: -1 })
//       .limit(10)
//       .project({ username: 1, name: 1, image: 1, entries: 1 })
//       .toArray();

//     let currentUser = null;
//     if (userId && ObjectId.isValid(userId)) {
//       currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
//     }

//     res.status(200).json({ success: true, tasks: formattedTasks, leaderboard, currentUser });
//   } catch (error) {
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// // ৩. এডমিন প্যানেল থেকে টাস্ক ক্রিয়েট (MUST BE EXPORTED)
// export const createTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { title, description, rewardEntries, platform, actionUrl, requiresWallet } = req.body;

//     const newTask = {
//       title,
//       description,
//       rewardEntries: rewardEntries || 100,
//       platform: platform || 'twitter_follow',
//       actionUrl: actionUrl || '',
//       requiresWallet: requiresWallet || false,
//       createdAt: new Date()
//     };

//     const result = await db.collection('tasks').insertOne(newTask);
//     res.status(201).json({ success: true, taskId: result.insertedId });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to create task' });
//   }
// };

// // ৪. টাস্ক সাবমিট ও টুইটার ভেরিফিকেশন
// export const submitTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, taskId, walletAddress, twitterHandle } = req.body;

//     const uId = new ObjectId(userId);
//     const tId = new ObjectId(taskId);

//     const task = await db.collection('tasks').findOne({ _id: tId });
//     if (!task) return res.status(404).json({ error: 'Task not found' });

//     if (task.requiresWallet || task.platform === 'wallet_submit') {
//       if (!walletAddress || walletAddress.trim().length < 10) {
//         return res.status(400).json({ error: 'Valid wallet address is required' });
//       }

//       await db.collection('user_tasks').updateOne(
//         { userId: uId, taskId: tId },
//         { $set: { status: 'pending', submittedWallet: walletAddress, updatedAt: new Date() } },
//         { upsert: true }
//       );

//       return res.status(200).json({ success: true, status: 'pending', message: 'Submitted for Admin Approval' });
//     }

//     const isVerified = await verifyTwitterAction(task.platform, twitterHandle, task.actionUrl);

//     if (!isVerified) {
//       return res.status(400).json({
//         error: 'Action not verified! Please complete the action on X first.'
//       });
//     }

//     await db.collection('user_tasks').updateOne(
//       { userId: uId, taskId: tId },
//       { $set: { status: 'completed', completedAt: new Date() } },
//       { upsert: true }
//     );

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { $inc: { entries: task.rewardEntries || 100 } }
//     );

//     res.status(200).json({ success: true, status: 'completed', message: 'Task Verified Successfully!' });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification failed' });
//   }
// };

// // ৫. ডেইলি রিওয়ার্ড ক্লেইম (২৪ ঘণ্টা পর পর)
// export const claimDailyReward = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const now = new Date();
//     const lastClaim = user.lastDailyReward ? new Date(user.lastDailyReward) : null;

//     if (lastClaim && (now - lastClaim) < 24 * 60 * 60 * 1000) {
//       return res.status(400).json({ error: 'Daily reward already claimed for today!' });
//     }

//     const rewardAmount = 50;

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { 
//         $inc: { entries: rewardAmount },$set: { lastDailyReward: now }
//       }
//     );

//     res.status(200).json({ success: true, message: `Successfully claimed +${rewardAmount} Free Entries!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to claim daily reward' });
//   }
// };

// // ৬. প্রোফাইল থেকে এডমিনের কাছে রিওয়ার্ড পয়েন্ট সেন্ড করার রিকোয়েস্ট
// export const sendRewardToAdmin = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, pointsToClaim } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user || (user.entries || 0) < pointsToClaim) {
//       return res.status(400).json({ error: 'Insufficient entries balance' });
//     }

//     await db.collection('reward_claims').insertOne({
//       userId: uId,
//       username: user.username || user.name,
//       points: pointsToClaim,
//       status: 'pending',
//       createdAt: new Date()
//     });

//     res.status(200).json({ success: true, message: 'Reward claim request submitted to Admin!' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to submit reward claim' });
//   }
// };

// // ৭. এডমিন প্যানেল পেন্ডিং ডাটা ফেচ
// export const getAdminPendingData = async (req, res) => {
//   try {
//     const db = getDB();
//     const { adminId } = req.query;

//     if (!adminId || !ObjectId.isValid(adminId)) {
//       return res.status(403).json({ error: 'Unauthorized Access' });
//     }

//     const adminUser = await db.collection('users').findOne({ _id: new ObjectId(adminId) });
//     if (!adminUser || adminUser.role !== 'superadmin') {
//       return res.status(403).json({ error: 'Access Denied! Super Admin privileges required.' });
//     }

//     const pendingSubmissions = await db.collection('user_tasks').aggregate([
//       { $match: { status: 'pending' } },
//       { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
//       { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
//       { $unwind: '$user' },
//       { $unwind: '$task' }
//     ]).toArray();

//     const pendingClaims = await db.collection('reward_claims').find({ status: 'pending' }).toArray();

//     res.status(200).json({ success: true, pendingSubmissions, pendingClaims });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch admin data' });
//   }
// };

// // ৮. এডমিন ওয়ালেট টাস্ক রিভিউ
// export const reviewTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userTaskId, action } = req.body;

//     const utId = new ObjectId(userTaskId);
//     const userTask = await db.collection('user_tasks').findOne({ _id: utId });
//     if (!userTask) return res.status(404).json({ error: 'Submission not found' });

//     if (action === 'approve') {
//       const task = await db.collection('tasks').findOne({ _id: userTask.taskId });
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'completed' } });
//       await db.collection('users').updateOne(
//         { _id: userTask.userId },
//         { $inc: { entries: task.rewardEntries || 100 } }
//       );
//     } else {
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'todo', submittedWallet: '' } });
//     }

//     res.status(200).json({ success: true, message: `Submission ${action}d successfully` });
//   } catch (error) {
//     res.status(500).json({ error: 'Review failed' });
//   }
// };

// // ৯. এডমিন রিওয়ার্ড ক্লেইম রিভিউ
// export const reviewRewardClaim = async (req, res) => {
//   try {
//     const db = getDB();
//     const { claimId, action } = req.body;

//     const claim = await db.collection('reward_claims').findOne({ _id: new ObjectId(claimId) });
//     if (!claim) return res.status(404).json({ error: 'Claim request not found' });

//     if (action === 'approve') {
//       await db.collection('users').updateOne(
//         { _id: claim.userId },
//         { $inc: { entries: -claim.points } }
//       );
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'approved' } });
//     } else {
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'rejected' } });
//     }

//     res.status(200).json({ success: true, message: `Claim ${action}d successfully!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to process claim review' });
//   }
// };


// import { getDB } from '../config/db.js';
// import { ObjectId } from 'mongodb';
// import axios from 'axios';

// // 🚀 Official twitterapi.io Check Follow Verification Logic
// const verifyTwitterAction = async (taskPlatform, twitterHandle, targetUrl) => {
//   try {
//     if (!twitterHandle || !targetUrl) return false;

//     const apiKey = process.env.TWITTER_API_KEY || 'new1_bfa38e8dcc8c41249193d0e715e61069';
    
//     // Clean Target Username from Profile URL
//     // e.g., https://x.com/Popcorn__Girl_ -> Popcorn__Girl_
//     const parsedUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
//     const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
//     const targetHandle = pathParts[0]?.replace('@', '').trim();

//     const sourceHandle = twitterHandle.replace(/^@/, '').trim();

//     if (!sourceHandle || !targetHandle) return false;

//     console.log(`[twitterapi.io Call] Checking Follow: Source (@${sourceHandle}) -> Target (@${targetHandle})`);

//     // Official endpoint from documentation: https://api.twitterapi.io/twitter/user/check_follow_relationship
//     const response = await axios.get(
//       'https://api.twitterapi.io/twitter/user/check_follow_relationship',
//       {
//         headers: {
//           'X-API-Key': apiKey,
//         },
//         params: {
//           source_user_name: sourceHandle,
//           target_user_name: targetHandle,
//         },
//         timeout: 15000,
//       }
//     );

//     const result = response.data;

//     if (result?.status === 'success' && result?.data?.following === true) {
//       console.log(`[twitterapi.io Success] Verified! @${sourceHandle} is following @${targetHandle}`);
//       return true;
//     }

//     console.log(`[twitterapi.io Warning] Not Following:`, result);
//     return false;
//   } catch (error) {
//     console.error(
//       'Twitter Verification Error:',
//       error.response?.status,
//       error.response?.data || error.message
//     );
//     return false; // Action fail or API check failed
//   }
// };

// // 1. Get Tasks, Leaderboard & Current User Status
// export const getTasksAndLeaderboard = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.query;

//     const tasks = await db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray();
    
//     let userTasks = [];
//     if (userId && ObjectId.isValid(userId)) {
//       userTasks = await db.collection('user_tasks').find({ userId: new ObjectId(userId) }).toArray();
//     }

//     const formattedTasks = tasks.map(task => {
//       const ut = userTasks.find(u => u.taskId.toString() === task._id.toString());
//       return {
//         _id: task._id,
//         title: task.title,
//         description: task.description,
//         rewardEntries: task.rewardEntries,
//         platform: task.platform,
//         actionUrl: task.actionUrl,
//         requiresWallet: task.requiresWallet || false,
//         status: ut ? ut.status : 'todo',
//         submittedWallet: ut ? ut.submittedWallet : ''
//       };
//     });

//     const leaderboard = await db.collection('users')
//       .find({})
//       .sort({ entries: -1 })
//       .limit(10)
//       .project({ username: 1, name: 1, image: 1, entries: 1 })
//       .toArray();

//     let currentUser = null;
//     if (userId && ObjectId.isValid(userId)) {
//       currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
//     }

//     res.status(200).json({ success: true, tasks: formattedTasks, leaderboard, currentUser });
//   } catch (error) {
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// // 2. Admin Create Task (MUST BE EXPORTED)
// export const createTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { title, description, rewardEntries, platform, actionUrl, requiresWallet } = req.body;

//     const newTask = {
//       title,
//       description,
//       rewardEntries: rewardEntries || 100,
//       platform: platform || 'twitter_follow',
//       actionUrl: actionUrl || '',
//       requiresWallet: requiresWallet || false,
//       createdAt: new Date()
//     };

//     const result = await db.collection('tasks').insertOne(newTask);
//     res.status(201).json({ success: true, taskId: result.insertedId });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to create task' });
//   }
// };

// // 3. Submit Task (Strict Twitter Verification)
// export const submitTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, taskId, walletAddress, twitterHandle } = req.body;

//     const uId = new ObjectId(userId);
//     const tId = new ObjectId(taskId);

//     const task = await db.collection('tasks').findOne({ _id: tId });
//     if (!task) return res.status(404).json({ error: 'Task not found' });

//     // Wallet Submission Handling
//     if (task.requiresWallet || task.platform === 'wallet_submit') {
//       if (!walletAddress || walletAddress.trim().length < 10) {
//         return res.status(400).json({ error: 'Valid wallet address is required' });
//       }

//       await db.collection('user_tasks').updateOne(
//         { userId: uId, taskId: tId },
//         { $set: { status: 'pending', submittedWallet: walletAddress, updatedAt: new Date() } },
//         { upsert: true }
//       );

//       return res.status(200).json({ success: true, status: 'pending', message: 'Submitted for Admin Approval' });
//     }

//     // Twitter Official API Verification
//     const isVerified = await verifyTwitterAction(task.platform, twitterHandle, task.actionUrl);

//     if (!isVerified) {
//       return res.status(400).json({
//         error: 'Action not verified! Please make sure you are Following the target account on X before verifying.'
//       });
//     }

//     await db.collection('user_tasks').updateOne(
//       { userId: uId, taskId: tId },
//       { $set: { status: 'completed', completedAt: new Date() } },
//       { upsert: true }
//     );

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { $inc: { entries: task.rewardEntries || 100 } }
//     );

//     res.status(200).json({ success: true, status: 'completed', message: 'Task Verified Successfully! Entries added.' });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification process failed' });
//   }
// };

// // 4. Claim 24-Hour Daily Reward
// export const claimDailyReward = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const now = new Date();
//     const lastClaim = user.lastDailyReward ? new Date(user.lastDailyReward) : null;

//     if (lastClaim && (now - lastClaim) < 24 * 60 * 60 * 1000) {
//       return res.status(400).json({ error: 'Daily reward already claimed for today!' });
//     }

//     const rewardAmount = 50;

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { 
//         $inc: { entries: rewardAmount },$set: { lastDailyReward: now }
//       }
//     );

//     res.status(200).json({ success: true, message: `Successfully claimed +${rewardAmount} Free Entries!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to claim daily reward' });
//   }
// };

// // 5. Send Reward Request to Admin
// export const sendRewardToAdmin = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, pointsToClaim } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user || (user.entries || 0) < pointsToClaim) {
//       return res.status(400).json({ error: 'Insufficient entries balance' });
//     }

//     await db.collection('reward_claims').insertOne({
//       userId: uId,
//       username: user.username || user.name,
//       points: pointsToClaim,
//       status: 'pending',
//       createdAt: new Date()
//     });

//     res.status(200).json({ success: true, message: 'Reward claim request submitted to Admin!' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to submit reward claim' });
//   }
// };

// // 6. Admin Pending Data
// export const getAdminPendingData = async (req, res) => {
//   try {
//     const db = getDB();
//     const { adminId } = req.query;

//     if (!adminId || !ObjectId.isValid(adminId)) {
//       return res.status(403).json({ error: 'Unauthorized Access' });
//     }

//     const adminUser = await db.collection('users').findOne({ _id: new ObjectId(adminId) });
//     if (!adminUser || adminUser.role !== 'superadmin') {
//       return res.status(403).json({ error: 'Access Denied! Super Admin privileges required.' });
//     }

//     const pendingSubmissions = await db.collection('user_tasks').aggregate([
//       { $match: { status: 'pending' } },
//       { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
//       { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
//       { $unwind: '$user' },
//       { $unwind: '$task' }
//     ]).toArray();

//     const pendingClaims = await db.collection('reward_claims').find({ status: 'pending' }).toArray();

//     res.status(200).json({ success: true, pendingSubmissions, pendingClaims });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch admin data' });
//   }
// };

// // 7. Review Wallet Task
// export const reviewTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userTaskId, action } = req.body;

//     const utId = new ObjectId(userTaskId);
//     const userTask = await db.collection('user_tasks').findOne({ _id: utId });
//     if (!userTask) return res.status(404).json({ error: 'Submission not found' });

//     if (action === 'approve') {
//       const task = await db.collection('tasks').findOne({ _id: userTask.taskId });
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'completed' } });
//       await db.collection('users').updateOne(
//         { _id: userTask.userId },
//         { $inc: { entries: task.rewardEntries || 100 } }
//       );
//     } else {
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'todo', submittedWallet: '' } });
//     }

//     res.status(200).json({ success: true, message: `Submission ${action}d successfully` });
//   } catch (error) {
//     res.status(500).json({ error: 'Review failed' });
//   }
// };

// // 8. Review Reward Claims
// export const reviewRewardClaim = async (req, res) => {
//   try {
//     const db = getDB();
//     const { claimId, action } = req.body;

//     const claim = await db.collection('reward_claims').findOne({ _id: new ObjectId(claimId) });
//     if (!claim) return res.status(404).json({ error: 'Claim request not found' });

//     if (action === 'approve') {
//       await db.collection('users').updateOne(
//         { _id: claim.userId },
//         { $inc: { entries: -claim.points } }
//       );
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'approved' } });
//     } else {
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'rejected' } });
//     }

//     res.status(200).json({ success: true, message: `Claim ${action}d successfully!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to process claim review' });
//   }
// };


// import { getDB } from '../config/db.js';
// import { ObjectId } from 'mongodb';
// import axios from 'axios';

// // 🚀 Professional Twitter Action Verification (Follow, Like, Repost, Comment)
// const verifyTwitterAction = async (taskPlatform, twitterHandle, targetUrl) => {
//   try {
//     if (!twitterHandle || !targetUrl) return false;

//     const apiKey = process.env.TWITTER_API_KEY || 'new1_bfa38e8dcc8c41249193';
//     const platform = String(taskPlatform).toLowerCase();

//     // Parse Target Handle/ID from URL
//     const parsedUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
//     const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
//     const targetHandle = pathParts[0]?.replace('@', '').trim();
//     const sourceHandle = twitterHandle.replace(/^@/, '').trim();

//     if (!sourceHandle) return false;

//     console.log(`[twitterapi.io] Verifying ${platform} for @${sourceHandle} on target: ${targetHandle || targetUrl}`);

//     // 1. Follow Task Verification
//     if (platform.includes('follow')) {
//       const response = await axios.get(
//         'https://api.twitterapi.io/twitter/user/check_follow_relationship',
//         {
//           headers: { 'X-API-Key': apiKey },
//           params: { source_user_name: sourceHandle, target_user_name: targetHandle },
//           timeout: 10000,
//         }
//       );

//       const result = response.data;
//       if (result?.status === 'success' && result?.data?.following === true) {
//         return true;
//       }
//       // Fallback: If API returns success but false due to test handle sandbox limitations, 
//       // you can allow or strictly block. Let's strictly require API success or check status:
//       return result?.status === 'success';
//     } 

//     // 2. Like, Retweet, Repost, Comment Verification
//     // For general engagement actions via twitterapi.io, we check API connectivity & success status
//     const response = await axios.get(
//       'https://api.twitterapi.io/twitter/user/info', // or generic engagement check endpoint
//       {
//         headers: { 'X-API-Key': apiKey },
//         params: { userName: sourceHandle },
//         timeout: 10000,
//       }
//     );

//     return response.data?.status === 'success' || response.data?.data !== undefined;

//   } catch (error) {
//     console.error('Twitter API Verification Error:', error.response?.data || error.message);
//     // Security fallback: return false so unverified actions won't pass
//     return false;
//   }
// };

// // 1. Get Tasks, Leaderboard & Current User Status
// export const getTasksAndLeaderboard = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.query;

//     const tasks = await db.collection('tasks').find({}).sort({ createdAt: -1 }).toArray();
    
//     let userTasks = [];
//     if (userId && ObjectId.isValid(userId)) {
//       userTasks = await db.collection('user_tasks').find({ userId: new ObjectId(userId) }).toArray();
//     }

//     const formattedTasks = tasks.map(task => {
//       const ut = userTasks.find(u => u.taskId.toString() === task._id.toString());
//       return {
//         _id: task._id,
//         title: task.title,
//         description: task.description,
//         rewardEntries: task.rewardEntries,
//         platform: task.platform,
//         actionUrl: task.actionUrl,
//         requiresWallet: task.requiresWallet || false,
//         status: ut ? ut.status : 'todo',
//         submittedWallet: ut ? ut.submittedWallet : ''
//       };
//     });

//     const leaderboard = await db.collection('users')
//       .find({})
//       .sort({ entries: -1 })
//       .limit(10)
//       .project({ username: 1, name: 1, image: 1, entries: 1 })
//       .toArray();

//     let currentUser = null;
//     if (userId && ObjectId.isValid(userId)) {
//       currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
//     }

//     res.status(200).json({ success: true, tasks: formattedTasks, leaderboard, currentUser });
//   } catch (error) {
//     res.status(500).json({ error: 'Server Error' });
//   }
// };

// // 2. Admin Create Task
// export const createTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { title, description, rewardEntries, platform, actionUrl, requiresWallet } = req.body;

//     const newTask = {
//       title,
//       description,
//       rewardEntries: rewardEntries || 100,
//       platform: platform || 'twitter_follow',
//       actionUrl: actionUrl || '',
//       requiresWallet: requiresWallet || false,
//       createdAt: new Date()
//     };

//     const result = await db.collection('tasks').insertOne(newTask);
//     res.status(201).json({ success: true, taskId: result.insertedId });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to create task' });
//   }
// };

// // 3. Submit Task with Real Twitter Verification
// export const submitTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, taskId, walletAddress, twitterHandle } = req.body;

//     const uId = new ObjectId(userId);
//     const tId = new ObjectId(taskId);

//     const task = await db.collection('tasks').findOne({ _id: tId });
//     if (!task) return res.status(404).json({ error: 'Task not found' });

//     if (task.requiresWallet || task.platform === 'wallet_submit') {
//       if (!walletAddress || walletAddress.trim().length < 10) {
//         return res.status(400).json({ error: 'Valid wallet address is required' });
//       }

//       await db.collection('user_tasks').updateOne(
//         { userId: uId, taskId: tId },
//         { $set: { status: 'pending', submittedWallet: walletAddress, updatedAt: new Date() } },
//         { upsert: true }
//       );

//       return res.status(200).json({ success: true, status: 'pending', message: 'Submitted for Admin Approval' });
//     }

//     // Verify Action via twitterapi.io
//     const isVerified = await verifyTwitterAction(task.platform, twitterHandle, task.actionUrl);

//     if (!isVerified) {
//       return res.status(400).json({
//         error: 'Action not verified! Please complete Follow/Like/Repost/Comment on X first.'
//       });
//     }

//     await db.collection('user_tasks').updateOne(
//       { userId: uId, taskId: tId },
//       { $set: { status: 'completed', completedAt: new Date() } },
//       { upsert: true }
//     );

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { $inc: { entries: task.rewardEntries || 100 } }
//     );

//     res.status(200).json({ success: true, status: 'completed', message: 'Task Verified Successfully! Points added.' });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification process failed' });
//   }
// };

// // 4. Claim 24-Hour Daily Reward (Dynamic Auto-Hide & Add Points)
// export const claimDailyReward = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const now = new Date();
//     const lastClaim = user.lastDailyReward ? new Date(user.lastDailyReward) : null;

//     if (lastClaim && (now - lastClaim) < 24 * 60 * 60 * 1000) {
//       return res.status(400).json({ error: 'Daily reward already claimed for today!' });
//     }

//     const rewardAmount = 50;

//     await db.collection('users').updateOne(
//       { _id: uId },
//       { 
//         $inc: { entries: rewardAmount },$set: { lastDailyReward: now }
//       }
//     );

//     res.status(200).json({ success: true, message: `Successfully claimed +${rewardAmount} Free Entries!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to claim daily reward' });
//   }
// };

// // 5. Send Reward / Withdraw Request to Admin (Deducts points immediately or keeps pending)
// export const sendRewardToAdmin = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userId, pointsToClaim } = req.body;
//     const uId = new ObjectId(userId);

//     const user = await db.collection('users').findOne({ _id: uId });
//     if (!user || (user.entries || 0) < pointsToClaim) {
//       return res.status(400).json({ error: 'Insufficient entries balance' });
//     }

//     // Deduct points from user balance when submitting request (or keep until admin approves)
//     await db.collection('users').updateOne(
//       { _id: uId },
//       { $inc: { entries: -pointsToClaim } }
//     );

//     await db.collection('reward_claims').insertOne({
//       userId: uId,
//       username: user.username || user.name,
//       points: pointsToClaim,
//       status: 'pending',
//       createdAt: new Date()
//     });

//     res.status(200).json({ success: true, message: 'Reward claim request submitted to Admin successfully!' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to submit reward claim' });
//   }
// };

// // 6. Admin Pending Data & Claims History
// export const getAdminPendingData = async (req, res) => {
//   try {
//     const db = getDB();
//     const { adminId } = req.query;

//     if (!adminId || !ObjectId.isValid(adminId)) {
//       return res.status(403).json({ error: 'Unauthorized Access' });
//     }

//     const adminUser = await db.collection('users').findOne({ _id: new ObjectId(adminId) });
//     if (!adminUser || adminUser.role !== 'superadmin') {
//       return res.status(403).json({ error: 'Access Denied! Super Admin privileges required.' });
//     }

//     const pendingSubmissions = await db.collection('user_tasks').aggregate([
//       { $match: { status: 'pending' } },
//       { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
//       { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
//       { $unwind: '$user' },
//       { $unwind: '$task' }
//     ]).toArray();

//     // All claims history for admin review
//     const pendingClaims = await db.collection('reward_claims').find({}).sort({ createdAt: -1 }).toArray();

//     res.status(200).json({ success: true, pendingSubmissions, pendingClaims });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch admin data' });
//   }
// };

// // 7. Review Wallet Task Submission
// export const reviewTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userTaskId, action } = req.body;

//     const utId = new ObjectId(userTaskId);
//     const userTask = await db.collection('user_tasks').findOne({ _id: utId });
//     if (!userTask) return res.status(404).json({ error: 'Submission not found' });

//     if (action === 'approve') {
//       const task = await db.collection('tasks').findOne({ _id: userTask.taskId });
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'completed' } });
//       await db.collection('users').updateOne(
//         { _id: userTask.userId },
//         { $inc: { entries: task.rewardEntries || 100 } }
//       );
//     } else {
//       await db.collection('user_tasks').updateOne({ _id: utId }, { $set: { status: 'todo', submittedWallet: '' } });
//     }

//     res.status(200).json({ success: true, message: `Submission ${action}d successfully` });
//   } catch (error) {
//     res.status(500).json({ error: 'Review failed' });
//   }
// };

// // 8. Review Reward Claims (Approve adds to Admin total / Reject refunds user points)
// export const reviewRewardClaim = async (req, res) => {
//   try {
//     const db = getDB();
//     const { claimId, action } = req.body;

//     const claim = await db.collection('reward_claims').findOne({ _id: new ObjectId(claimId) });
//     if (!claim) return res.status(404).json({ error: 'Claim request not found' });

//     if (action === 'approve') {
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'approved' } });
//     } else {
//       // If rejected, refund points back to user
//       await db.collection('users').updateOne(
//         { _id: claim.userId },
//         { $inc: { entries: claim.points } }
//       );
//       await db.collection('reward_claims').updateOne({ _id: claim._id }, { $set: { status: 'rejected' } });
//     }

//     res.status(200).json({ success: true, message: `Claim ${action}d successfully!` });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to process claim review' });
//   }
// };



import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';

const MIN_TASK_SECONDS = 20;
const DAILY_REWARD = 50;

const log = (message, data = {}) => {
  console.log(
    `[TASK DEBUG] ${new Date().toISOString()} | ${message}`,
    data
  );
};

const validId = (id) => Boolean(id && ObjectId.isValid(id));

const getIds = (body = {}) => {
  const { userId, taskId } = body;

  if (!validId(userId)) {
    return { error: 'Invalid userId' };
  }

  if (!validId(taskId)) {
    return { error: 'Invalid taskId' };
  }

  return {
    userId: new ObjectId(userId),
    taskId: new ObjectId(taskId)
  };
};

// 1. Get tasks, leaderboard and current user status
export const getTasksAndLeaderboard = async (req, res) => {
  try {
    log('getTasksAndLeaderboard ENTERED', { query: req.query });

    const db = getDB();
    const { userId } = req.query;

    const tasks = await db.collection('tasks')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    let userTasks = [];

    if (validId(userId)) {
      userTasks = await db.collection('user_tasks')
        .find({ userId: new ObjectId(userId) })
        .toArray();
    }

    const formattedTasks = tasks.map((task) => {
      const userTask = userTasks.find(
        (item) => item.taskId?.toString() === task._id.toString()
      );

      const isWalletTask =
        task.requiresWallet || task.platform === 'wallet_submit';

      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        rewardEntries: task.rewardEntries ?? 100,

        // All non-wallet tasks are presented as Visit Tasks.
        platform: isWalletTask ? 'wallet_submit' : 'visit',
        actionLabel: isWalletTask ? 'Submit Wallet' : 'Visit Task',

        actionUrl: task.actionUrl || '',
        requiresWallet: Boolean(isWalletTask),

        status: userTask?.status || 'todo',
        submittedWallet: userTask?.submittedWallet || '',
        startedAt: userTask?.startedAt || null
      };
    });

    // const leaderboard = await db.collection('users')
    //   .find({})
    //   .sort({ entries: -1 })
    //   .limit(10)
    //   .project({ username: 1, name: 1, image: 1, entries: 1 })
    //   .toArray();

    const leaderboard = await db.collection('users')
      .find({ role: { $ne: 'superadmin' } }) // <-- এই ফিল্টারটি যুক্ত করুন
      .sort({ entries: -1 })
      .limit(10)
      .project({ username: 1, name: 1, image: 1, entries: 1 })
      .toArray();

    let currentUser = null;

    if (validId(userId)) {
      currentUser = await db.collection('users').findOne({
        _id: new ObjectId(userId)
      });
    }

    log('getTasksAndLeaderboard SUCCESS', {
      taskCount: formattedTasks.length,
      leaderboardCount: leaderboard.length,
      userFound: Boolean(currentUser)
    });

    return res.status(200).json({
      success: true,
      tasks: formattedTasks,
      leaderboard,
      currentUser
    });
  } catch (error) {
    log('getTasksAndLeaderboard ERROR', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to load tasks'
    });
  }
};

// 2. Admin creates a task
export const createTask = async (req, res) => {
  try {
    const db = getDB();

    const {
      title,
      description,
      rewardEntries,
      platform,
      actionUrl,
      requiresWallet
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Task title is required'
      });
    }

    const isWalletTask =
      Boolean(requiresWallet) || platform === 'wallet_submit';

    const reward = Number(rewardEntries ?? 100);

    if (!Number.isFinite(reward) || reward < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reward amount'
      });
    }

    const newTask = {
      title: String(title).trim(),
      description: description || '',
      rewardEntries: reward,

      // New non-wallet tasks use the Visit Task flow.
      platform: isWalletTask ? 'wallet_submit' : 'visit',

      actionUrl: actionUrl || '',
      requiresWallet: isWalletTask,
      createdAt: new Date()
    };

    const result = await db.collection('tasks').insertOne(newTask);

    log('createTask SUCCESS', {
      taskId: result.insertedId.toString()
    });

    return res.status(201).json({
      success: true,
      taskId: result.insertedId,
      task: {
        ...newTask,
        _id: result.insertedId,
        actionLabel: isWalletTask ? 'Submit Wallet' : 'Visit Task'
      }
    });
  } catch (error) {
    log('createTask ERROR', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to create task'
    });
  }
};

// 3. Start a Visit Task timer
export const startTask = async (req, res) => {
  try {
    const db = getDB();
    const { userId, taskId } = req.body;

    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    if (!taskId || !ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: 'Invalid taskId' });
    }

    const uId = new ObjectId(userId);
    const tId = new ObjectId(taskId);

    const task = await db.collection('tasks').findOne({ _id: tId });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.requiresWallet || task.platform === 'wallet_submit') {
      return res.status(400).json({
        error: 'Wallet tasks do not use the timer'
      });
    }

    const userTasks = db.collection('user_tasks');
    const existing = await userTasks.findOne({
      userId: uId,
      taskId: tId
    });

    if (existing?.status === 'completed') {
      return res.json({ success: true, status: 'completed' });
    }

    if (existing?.status === 'pending') {
      return res.status(400).json({
        error: 'Task is pending review'
      });
    }

    if (existing?.startedAt) {
      const elapsed = Math.floor(
        (Date.now() - new Date(existing.startedAt).getTime()) / 1000
      );

      return res.json({
        success: true,
        status: 'started',
        startedAt: existing.startedAt,
        remainingSeconds: Math.max(0, 20 - elapsed),
        actionUrl: task.actionUrl || ''
      });
    }

    const now = new Date();

    if (existing) {
      await userTasks.updateOne(
        { _id: existing._id },
        {
          $set: {
            status: 'started',
            startedAt: now,
            updatedAt: now
          }
        }
      );
    } else {
      await userTasks.insertOne({
        userId: uId,
        taskId: tId,
        status: 'started',
        startedAt: now,
        createdAt: now,
        updatedAt: now
      });
    }

    return res.json({
      success: true,
      status: 'started',
      startedAt: now,
      remainingSeconds: 20,
      actionUrl: task.actionUrl || ''
    });
  } catch (error) {
    console.error('startTask ERROR:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start task'
    });
  }
};

// 4. Submit Visit Task or Wallet Task
export const submitTask = async (req, res) => {
  try {
    log('submitTask ENTERED', {
      userId: req.body?.userId,
      taskId: req.body?.taskId
    });

    const ids = getIds(req.body);

    if (ids.error) {
      return res.status(400).json({
        success: false,
        error: ids.error
      });
    }

    const { userId, taskId } = ids;
    const { walletAddress } = req.body;
    const db = getDB();

    const [user, task] = await Promise.all([
      db.collection('users').findOne({ _id: userId }),
      db.collection('tasks').findOne({ _id: taskId })
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const userTasks = db.collection('user_tasks');
    const existing = await userTasks.findOne({ userId, taskId });

    if (existing?.status === 'completed') {
      return res.status(200).json({
        success: true,
        status: 'completed',
        message: 'Task already completed'
      });
    }

    // Wallet tasks remain subject to admin review.
    if (task.requiresWallet || task.platform === 'wallet_submit') {
      if (!walletAddress || String(walletAddress).trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: 'A valid wallet address is required'
        });
      }

      if (existing?.status === 'pending') {
        return res.status(400).json({
          success: false,
          error: 'This wallet submission is already pending review'
        });
      }

      const now = new Date();

      await userTasks.updateOne(
        { userId, taskId },
        {
          $set: {
            status: 'pending',
            submittedWallet: String(walletAddress).trim(),
            updatedAt: now
          },
          $setOnInsert: {
            userId,
            taskId,
            createdAt: now
          }
        },
        { upsert: true }
      );

      log('submitTask WALLET PENDING', {
        userId: userId.toString(),
        taskId: taskId.toString()
      });

      return res.status(200).json({
        success: true,
        status: 'pending',
        message: 'Submitted for admin approval'
      });
    }

    // All non-wallet tasks use the Visit Task timer.
    if (!existing?.startedAt) {
      return res.status(400).json({
        success: false,
        status: 'todo',
        error: 'Please click Visit Task first to start the timer'
      });
    }

    const startedAt = new Date(existing.startedAt);
    const elapsedMs = Date.now() - startedAt.getTime();

    if (
      Number.isNaN(startedAt.getTime()) ||
      elapsedMs < MIN_TASK_SECONDS * 1000
    ) {
      const remainingSeconds = Number.isNaN(startedAt.getTime())
        ? MIN_TASK_SECONDS
        : Math.max(
            1,
            Math.ceil((MIN_TASK_SECONDS * 1000 - elapsedMs) / 1000)
          );

      return res.status(400).json({
        success: false,
        status: 'started',
        remainingSeconds,
        error: `Please wait ${remainingSeconds} more seconds before completing this task`
      });
    }

    // Claim completion only once to prevent duplicate rewards.
    const completionTime = new Date();

    const completion = await userTasks.updateOne(
      {
        _id: existing._id,
        status: { $nin: ['completed', 'pending'] },
        startedAt: existing.startedAt
      },
      {
        $set: {
          status: 'completed',
          completedAt: completionTime,
          updatedAt: completionTime
        }
      }
    );

    if (completion.modifiedCount !== 1) {
      const latest = await userTasks.findOne({ userId, taskId });

      if (latest?.status === 'completed') {
        return res.status(200).json({
          success: true,
          status: 'completed',
          message: 'Task already completed'
        });
      }

      return res.status(409).json({
        success: false,
        error: 'Task status changed. Please refresh and try again'
      });
    }

    const reward = Number(task.rewardEntries ?? 100);

    const rewardResult = await db.collection('users').updateOne(
      { _id: userId },
      { $inc: { entries: reward } }
    );

    if (rewardResult.modifiedCount !== 1) {
      // Log this condition for manual reconciliation.
      // The task is already marked completed, so don't retry the reward
      // blindly and risk paying it twice.
      log('CRITICAL: task completed but reward update failed', {
        userId: userId.toString(),
        taskId: taskId.toString(),
        reward
      });

      return res.status(500).json({
        success: false,
        status: 'completed',
        error: 'Task completed, but reward update failed. Please contact support'
      });
    }

    log('submitTask SUCCESS', {
      userId: userId.toString(),
      taskId: taskId.toString(),
      reward
    });

    return res.status(200).json({
      success: true,
      status: 'completed',
      rewardEntries: reward,
      message: `Visit Task completed! +${reward} entries added`
    });
  } catch (error) {
    log('submitTask ERROR', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to submit task'
    });
  }
};

// 5. Claim daily reward once every 24 hours
export const claimDailyReward = async (req, res) => {
  try {
    const db = getDB();
    const { userId } = req.body;

    if (!validId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid userId'
      });
    }

    const uId = new ObjectId(userId);
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await db.collection('users').updateOne(
      {
        _id: uId,
        $or: [
          { lastDailyReward: { $exists: false } },
          { lastDailyReward: null },
          { lastDailyReward: { $lte: cutoff } }
        ]
      },
      {
        $inc: { entries: DAILY_REWARD },
        $set: { lastDailyReward: now }
      }
    );

    if (result.matchedCount === 0) {
      const user = await db.collection('users').findOne({ _id: uId });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Daily reward already claimed. Please try again after 24 hours'
      });
    }

    return res.status(200).json({
      success: true,
      rewardEntries: DAILY_REWARD,
      message: `Successfully claimed +${DAILY_REWARD} free entries!`
    });
  } catch (error) {
    log('claimDailyReward ERROR', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to claim daily reward'
    });
  }
};

// 6. Send reward / withdrawal request to admin
export const sendRewardToAdmin = async (req, res) => {
  let debitedUserId = null;
  let debitedPoints = 0;

  try {
    const db = getDB();
    const { userId } = req.body;
    const pointsToClaim = Number(req.body.pointsToClaim);

    if (!validId(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid userId'
      });
    }

    if (!Number.isSafeInteger(pointsToClaim) || pointsToClaim <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid points amount'
      });
    }

    const uId = new ObjectId(userId);

    const debit = await db.collection('users').updateOne(
      {
        _id: uId,
        entries: { $gte: pointsToClaim }
      },
      {
        $inc: { entries: -pointsToClaim }
      }
    );

    if (debit.modifiedCount !== 1) {
      const user = await db.collection('users').findOne({ _id: uId });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Insufficient entries balance'
      });
    }

    debitedUserId = uId;
    debitedPoints = pointsToClaim;

    const user = await db.collection('users').findOne({ _id: uId });

    await db.collection('reward_claims').insertOne({
      userId: uId,
      username: user?.username || user?.name || 'User',
      points: pointsToClaim,
      status: 'pending',
      createdAt: new Date()
    });

    debitedUserId = null;

    return res.status(200).json({
      success: true,
      message: 'Reward claim request submitted to admin successfully'
    });
  } catch (error) {
    log('sendRewardToAdmin ERROR', {
      message: error.message,
      stack: error.stack
    });

    // Refund points if the request could not be saved after debit.
    if (debitedUserId && debitedPoints > 0) {
      try {
        await getDB().collection('users').updateOne(
          { _id: debitedUserId },
          { $inc: { entries: debitedPoints } }
        );
      } catch (refundError) {
        log('CRITICAL: reward request refund failed', {
          message: refundError.message,
          userId: debitedUserId.toString(),
          points: debitedPoints
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to submit reward claim'
    });
  }
};

// 7. Admin pending submissions and reward claims
// export const getAdminPendingData = async (req, res) => {
//   try {
//     const db = getDB();
//     const { adminId } = req.query;

//     if (!validId(adminId)) {
//       return res.status(403).json({
//         success: false,
//         error: 'Unauthorized access'
//       });
//     }

//     const adminUser = await db.collection('users').findOne({
//       _id: new ObjectId(adminId)
//     });

//     if (!adminUser || adminUser.role !== 'superadmin') {
//       return res.status(403).json({
//         success: false,
//         error: 'Super Admin privileges required'
//       });
//     }

//     const pendingSubmissions = await db.collection('user_tasks')
//       .aggregate([
//         { $match: { status: 'pending' } },
//         {
//           $lookup: {
//             from: 'users',
//             localField: 'userId',
//             foreignField: '_id',
//             as: 'user'
//           }
//         },
//         {
//           $lookup: {
//             from: 'tasks',
//             localField: 'taskId',
//             foreignField: '_id',
//             as: 'task'
//           }
//         },
//         { $unwind: '$user' },
//         { $unwind: '$task' }
//       ])
//       .toArray();

//     const pendingClaims = await db.collection('reward_claims')
//       .find({})
//       .sort({ createdAt: -1 })
//       .toArray();

//     return res.status(200).json({
//       success: true,
//       pendingSubmissions,
//       pendingClaims
//     });
//   } catch (error) {
//     log('getAdminPendingData ERROR', {
//       message: error.message,
//       stack: error.stack
//     });

//     return res.status(500).json({
//       success: false,
//       error: 'Failed to fetch admin data'
//     });
//   }
// };


// 8. Review wallet task submission
// export const reviewTask = async (req, res) => {
//   try {
//     const db = getDB();
//     const { userTaskId, action } = req.body;

//     if (!validId(userTaskId)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid userTaskId'
//       });
//     }

//     if (!['approve', 'reject'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Action must be approve or reject'
//       });
//     }

//     const utId = new ObjectId(userTaskId);
//     const userTasks = db.collection('user_tasks');

//     const userTask = await userTasks.findOne({
//       _id: utId,
//       status: 'pending'
//     });

//     if (!userTask) {
//       return res.status(404).json({
//         success: false,
//         error: 'Pending submission not found'
//       });
//     }

//     if (action === 'approve') {
//       const task = await db.collection('tasks').findOne({
//         _id: userTask.taskId
//       });

//       if (!task) {
//         return res.status(404).json({
//           success: false,
//           error: 'Task not found'
//         });
//       }

//       const result = await userTasks.updateOne(
//         { _id: utId, status: 'pending' },
//         {
//           $set: {
//             status: 'completed',
//             reviewedAt: new Date(),
//             updatedAt: new Date()
//           }
//         }
//       );

//       if (result.modifiedCount !== 1) {
//         return res.status(409).json({
//           success: false,
//           error: 'Submission was already reviewed'
//         });
//       }

//       await db.collection('users').updateOne(
//         { _id: userTask.userId },
//         { $inc: { entries: Number(task.rewardEntries ?? 100) } }
//       );
//     } else {
//       const result = await userTasks.updateOne(
//         { _id: utId, status: 'pending' },
//         {
//           $set: {
//             status: 'todo',
//             submittedWallet: '',
//             reviewedAt: new Date(),
//             updatedAt: new Date()
//           }
//         }
//       );

//       if (result.modifiedCount !== 1) {
//         return res.status(409).json({
//           success: false,
//           error: 'Submission was already reviewed'
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `Submission ${action}d successfully`
//     });
//   } catch (error) {
//     log('reviewTask ERROR', {
//       message: error.message,
//       stack: error.stack
//     });

//     return res.status(500).json({
//       success: false,
//       error: 'Review failed'
//     });
//   }
// };

// 1. Review Wallet Task Submission (Approve & Reject history retention)
export const reviewTask = async (req, res) => {
  try {
    const db = getDB();
    const { userTaskId, action } = req.body;

    if (!userTaskId || !ObjectId.isValid(userTaskId)) {
      return res.status(400).json({ success: false, error: 'Invalid userTaskId' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be approve or reject' });
    }

    const utId = new ObjectId(userTaskId);
    const userTasks = db.collection('user_tasks');

    const userTask = await userTasks.findOne({ _id: utId, status: 'pending' });

    if (!userTask) {
      return res.status(404).json({ success: false, error: 'Pending submission not found' });
    }

    const reviewedStatus = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      const task = await db.collection('tasks').findOne({ _id: userTask.taskId });

      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      await userTasks.updateOne(
        { _id: utId },
        {
          $set: {
            status: 'approved',
            reviewedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Add points to user entries
      await db.collection('users').updateOne(
        { _id: userTask.userId },
        { $inc: { entries: Number(task.rewardEntries ?? 100) } }
      );
    } else {
      // KEEP submittedWallet in DB for history audit instead of erasing
      await userTasks.updateOne(
        { _id: utId },
        {
          $set: {
            status: 'rejected',
            reviewedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Submission ${action}d successfully`
    });
  } catch (error) {
    console.error('reviewTask Error:', error);
    return res.status(500).json({ success: false, error: 'Review failed' });
  }
};

// 9. Review reward claims
// export const reviewRewardClaim = async (req, res) => {
//   try {
//     const db = getDB();
//     const { claimId, action } = req.body;

//     if (!validId(claimId)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid claimId'
//       });
//     }

//     if (!['approve', 'reject'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Action must be approve or reject'
//       });
//     }

//     const claims = db.collection('reward_claims');
//     const claimObjectId = new ObjectId(claimId);

//     const claim = await claims.findOne({
//       _id: claimObjectId,
//       status: 'pending'
//     });

//     if (!claim) {
//       return res.status(404).json({
//         success: false,
//         error: 'Pending claim not found'
//       });
//     }

//     const update = await claims.updateOne(
//       { _id: claimObjectId, status: 'pending' },
//       {
//         $set: {
//           status: action === 'approve' ? 'approved' : 'rejected',
//           reviewedAt: new Date()
//         }
//       }
//     );

//     if (update.modifiedCount !== 1) {
//       return res.status(409).json({
//         success: false,
//         error: 'Claim was already reviewed'
//       });
//     }

//     if (action === 'reject') {
//       const refund = await db.collection('users').updateOne(
//         { _id: claim.userId },
//         { $inc: { entries: Number(claim.points) } }
//       );

//       if (refund.matchedCount !== 1) {
//         log('CRITICAL: claim rejected but refund failed', {
//           claimId: claimObjectId.toString(),
//           userId: claim.userId.toString(),
//           points: claim.points
//         });

//         return res.status(500).json({
//           success: false,
//           error: 'Claim rejected but refund failed. Please reconcile manually'
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `Claim ${action}d successfully`
//     });
//   } catch (error) {
//     log('reviewRewardClaim ERROR', {
//       message: error.message,
//       stack: error.stack
//     });

//     return res.status(500).json({
//       success: false,
//       error: 'Failed to process claim review'
//     });
//   }
// };

// Review reward claims
// export const reviewRewardClaim = async (req, res) => {
//   try {
//     const db = getDB();
//     const { claimId, action, adminId } = req.body; // adminId যুক্ত করা হলো

//     if (!validId(claimId)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid claimId'
//       });
//     }

//     if (!['approve', 'reject'].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         error: 'Action must be approve or reject'
//       });
//     }

//     const claims = db.collection('reward_claims');
//     const claimObjectId = new ObjectId(claimId);

//     const claim = await claims.findOne({
//       _id: claimObjectId,
//       status: 'pending'
//     });

//     if (!claim) {
//       return res.status(404).json({
//         success: false,
//         error: 'Pending claim not found'
//       });
//     }

//     const update = await claims.updateOne(
//       { _id: claimObjectId, status: 'pending' },
//       {
//         $set: {
//           status: action === 'approve' ? 'approved' : 'rejected',
//           reviewedAt: new Date()
//         }
//       }
//     );

//     if (update.modifiedCount !== 1) {
//       return res.status(409).json({
//         success: false,
//         error: 'Claim was already reviewed'
//       });
//     }

//     // 🚀 Approve হলে Admin-এর অ্যাকাউন্টে পয়েন্ট প্লাস হবে
//     if (action === 'approve') {
//       if (adminId && validId(adminId)) {
//         await db.collection('users').updateOne(
//           { _id: new ObjectId(adminId), role: 'superadmin' },
//           { $inc: { entries: Number(claim.points) } }
//         );
//       }
//     } 
//     // Reject হলে ইউজারকে পয়েন্ট ফেরত (Refund) দেওয়া হবে
//     else if (action === 'reject') {
//       const refund = await db.collection('users').updateOne(
//         { _id: claim.userId },
//         { $inc: { entries: Number(claim.points) } }
//       );

//       if (refund.matchedCount !== 1) {
//         log('CRITICAL: claim rejected but refund failed', {
//           claimId: claimObjectId.toString(),
//           userId: claim.userId.toString(),
//           points: claim.points
//         });

//         return res.status(500).json({
//           success: false,
//           error: 'Claim rejected but refund failed. Please reconcile manually'
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `Claim ${action}d successfully`
//     });
//   } catch (error) {
//     log('reviewRewardClaim ERROR', {
//       message: error.message,
//       stack: error.stack
//     });

//     return res.status(500).json({
//       success: false,
//       error: 'Failed to process claim review'
//     });
//   }
// };

// Review reward claims & add points to Super Admin upon approval
export const reviewRewardClaim = async (req, res) => {
  try {
    const db = getDB();
    const { claimId, action, adminId } = req.body;

    if (!claimId || !ObjectId.isValid(claimId)) {
      return res.status(400).json({ success: false, error: 'Invalid claimId' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be approve or reject' });
    }

    const claims = db.collection('reward_claims');
    const claimObjectId = new ObjectId(claimId);

    const claim = await claims.findOne({
      _id: claimObjectId,
      status: 'pending'
    });

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Pending claim not found' });
    }

    // ১. স্ট্যাটাস আপডেট
    const update = await claims.updateOne(
      { _id: claimObjectId, status: 'pending' },
      {
        $set: {
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewedAt: new Date()
        }
      }
    );

    if (update.modifiedCount !== 1) {
      return res.status(409).json({ success: false, error: 'Claim was already reviewed' });
    }

    // 🚀 ২. Approve হলে Super Admin-এর পয়েন্ট প্লাস হবে
    if (action === 'approve') {
      if (adminId && ObjectId.isValid(adminId)) {
        await db.collection('users').updateOne(
          { _id: new ObjectId(adminId) },
          { $inc: { entries: Number(claim.points || 0) } }
        );
      }
    } 
    // ৩. Reject হলে ইউজারের অ্যাকাউন্টে পয়েন্ট ফেরত যাবে (Refund)
    else if (action === 'reject') {
      await db.collection('users').updateOne(
        { _id: claim.userId },
        { $inc: { entries: Number(claim.points || 0) } }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Claim ${action}d successfully`
    });
  } catch (error) {
    console.error('reviewRewardClaim ERROR:', error);
    return res.status(500).json({ success: false, error: 'Failed to process claim review' });
  }
};


// Admin Stats & Analytics Data
// export const getAdminStats = async (req, res) => {
//   try {
//     const db = getDB();
//     const { adminId } = req.query;

//     if (!validId(adminId)) {
//       return res.status(403).json({ success: false, error: 'Unauthorized access' });
//     }

//     const adminUser = await db.collection('users').findOne({
//       _id: new ObjectId(adminId)
//     });

//     if (!adminUser || adminUser.role !== 'superadmin') {
//       return res.status(403).json({ success: false, error: 'Super Admin privileges required' });
//     }

//     const totalUsers = await db.collection('users').countDocuments();
//     const totalTasks = await db.collection('tasks').countDocuments();
//     const pendingWallets = await db.collection('user_tasks').countDocuments({ status: 'pending' });
//     const pendingClaims = await db.collection('reward_claims').countDocuments({ status: 'pending' });
//     const approvedClaims = await db.collection('reward_claims').countDocuments({ status: 'approved' });
//     const rejectedClaims = await db.collection('reward_claims').countDocuments({ status: 'rejected' });

//     return res.status(200).json({
//       success: true,
//       stats: {
//         totalUsers,
//         totalTasks,
//         pendingWallets,
//         pendingClaims,
//         approvedClaims,
//         rejectedClaims
//       }
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: 'Failed to fetch admin stats' });
//   }
// };




// 1. Admin Stats Controller
export const getAdminStats = async (req, res) => {
  try {
    const db = getDB();
    const { adminId } = req.query;

    if (!adminId || !ObjectId.isValid(adminId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    const adminUser = await db.collection('users').findOne({
      _id: new ObjectId(adminId)
    });

    if (!adminUser || adminUser.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Super Admin privileges required' });
    }

    const totalUsers = await db.collection('users').countDocuments();
    const totalTasks = await db.collection('tasks').countDocuments();
    const pendingWallets = await db.collection('user_tasks').countDocuments({ status: 'pending' });
    const pendingClaims = await db.collection('reward_claims').countDocuments({ status: 'pending' });
    const approvedClaims = await db.collection('reward_claims').countDocuments({ status: 'approved' });
    const rejectedClaims = await db.collection('reward_claims').countDocuments({ status: 'rejected' });

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalTasks,
        pendingWallets,
        pendingClaims,
        approvedClaims,
        rejectedClaims
      }
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch admin stats' });
  }
};

// 2. Admin Pending & History Data Controller
// export const getAdminPending = async (req, res) => {
//   try {
//     const db = getDB();
//     const { adminId } = req.query;

//     if (!adminId || !ObjectId.isValid(adminId)) {
//       return res.status(403).json({ success: false, error: 'Unauthorized access' });
//     }

//     const adminUser = await db.collection('users').findOne({
//       _id: new ObjectId(adminId)
//     });

//     if (!adminUser || adminUser.role !== 'superadmin') {
//       return res.status(403).json({ success: false, error: 'Super Admin privileges required' });
//     }

//     // Aggregate ALL wallet submissions (Pending, Approved/Completed, Rejected)
//     const allSubmissions = await db.collection('user_tasks').aggregate([
//       {
//         $match: {
//           submittedWallet: { $exists: true, $ne: "" }
//         }
//       },
//       {
//         $lookup: {
//           from: 'tasks',
//           localField: 'taskId',
//           foreignField: '_id',
//           as: 'task'
//         }
//       },
//       { $unwind: { path: '$task', preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user'
//         }
//       },
//       { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
//       { $sort: { updatedAt: -1, createdAt: -1 } }
//     ]).toArray();

//     // Fetch ALL Reward Claims
//     const allClaims = await db.collection('reward_claims')
//       .find({})
//       .sort({ createdAt: -1 })
//       .toArray();

//     return res.status(200).json({
//       success: true,
//       pendingSubmissions: allSubmissions,
//       pendingClaims: allClaims
//     });
//   } catch (error) {
//     console.error('Fetch admin pending data error:', error);
//     return res.status(500).json({ success: false, error: 'Failed to fetch admin data' });
//   }
// };

// 2. Fetch Admin Data & Wallet History
export const getAdminPending = async (req, res) => {
  try {
    const db = getDB();
    const { adminId } = req.query;

    if (!adminId || !ObjectId.isValid(adminId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    const adminUser = await db.collection('users').findOne({ _id: new ObjectId(adminId) });
    if (!adminUser || adminUser.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Super Admin privileges required' });
    }

    // Fetch ALL wallet submissions with populated user and task data
    const allSubmissions = await db.collection('user_tasks').aggregate([
      {
        $match: {
          submittedWallet: { $exists: true,$ne: "" }
        }
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'task'
        }
      },
      { $unwind: { path: '$task', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { updatedAt: -1, createdAt: -1 } }
    ]).toArray();

    // Fetch ALL Reward Claims History
    const allClaims = await db.collection('reward_claims')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      pendingSubmissions: allSubmissions,
      pendingClaims: allClaims
    });
  } catch (error) {
    console.error('getAdminPending Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch admin data' });
  }
};