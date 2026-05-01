const Logger = (req, res, next) => {
    console.log(`Received ${req.method} Request to ${req.url} at "${new Date(Date.now()).toLocaleString()}"`);
    next();
};

export default Logger;