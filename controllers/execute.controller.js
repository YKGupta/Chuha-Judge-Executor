const ExecuteHandler = async (req, res) => {
    try
    {
        res.json({
            success: true,
            data: null,
            error: null
        });
    }
    catch(e)
    {
        return res.status(500).json({
            success: false,
            data: null,
            error: {
                message: e.message || "Internal Server Error",
                code: "INTERNAL_SERVER_ERROR"
            }
        });
    }
};

export { ExecuteHandler };