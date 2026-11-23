const router = require('express').Router();

router.use('/instances', require('./instances'));
router.use('/flows', require('./flows'));
router.use('/contacts', require('./contacts'));
router.use('/media', require('./media'));
router.use('/dashboard', require('./dashboard'));
router.use('/chats', require('./chats'));

module.exports = router;
