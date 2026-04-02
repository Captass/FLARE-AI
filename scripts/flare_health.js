const os = require('os');
const v8 = require('v8');
const { exec } = require('child_process');

// Function to get CPU Usage
function getCpuUsage() {
    return new Promise((resolve, reject) => {
        const start = process.cpuUsage();
        const startTime = Date.now();

        setTimeout(() => {
            const end = process.cpuUsage(start);
            const endTime = Date.now();
            const elapsed = (endTime - startTime) * 1000; // microseconds

            const user = end.user / elapsed;
            const system = end.system / elapsed;
            
            resolve({
                user: `${(user * 100).toFixed(2)}%`,
                system: `${(system * 100).toFixed(2)}%`,
                total: `${((user + system) * 100).toFixed(2)}%`
            });
        }, 1000);
    });
}

// Function to get Memory Usage
function getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const heapStats = v8.getHeapStatistics();

    return {
        total: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        used: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        free: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        heapTotal: `${(heapStats.total_heap_size / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(heapStats.used_heap_size / 1024 / 1024).toFixed(2)} MB`,
    };
}

// Function to get Disk Usage (for the current drive)
function getDiskUsage() {
    return new Promise((resolve, reject) => {
        const command = 'powershell.exe -Command "Get-PSDrive C | Select-Object Used,Free"'; 
        
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(`Error executing disk usage command: ${error.message}`);
            if (stderr && stderr.trim().length > 0) return reject(`Stderr: ${stderr}`);
            
            try {
                const lines = stdout.trim().split(/\r?\n/).slice(2);
                if (!lines || lines.length === 0 || !lines[0]) {
                    throw new Error("Unexpected PowerShell output format");
                }
                const [used, free] = lines[0].trim().split(/\s+/);

                const usedGB = (parseInt(used) / 1024 / 1024 / 1024).toFixed(2);
                const freeGB = (parseInt(free) / 1024 / 1024 / 1024).toFixed(2);
                const totalGB = ( (parseInt(used) + parseInt(free)) / 1024 / 1024 / 1024).toFixed(2);

                resolve({ total: `${totalGB} GB`, used: `${usedGB} GB`, free: `${freeGB} GB` });
            } catch (parseError) {
                reject(`Failed to parse disk usage output: ${stdout}`);
            }
        });
    });
}


async function runHealthCheck() {
    console.log("--- FlareAI System Health Report ---");
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log("\n--- System Info ---");
    console.log(`Hostname: ${os.hostname()}`);
    console.log(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
    console.log(`Uptime: ${(os.uptime() / 3600).toFixed(2)} hours`);

    try {
        console.log("\n--- CPU Usage (1s sample) ---");
        const cpu = await getCpuUsage();
        console.log(cpu);
    } catch (error) {
        console.error("Failed to get CPU usage:", error);
    }

    try {
        console.log("\n--- Memory Usage ---");
        const memory = getMemoryUsage();
        console.log(memory);
    } catch (error) {
        console.error("Failed to get Memory usage:", error);
    }

    try {
        console.log("\n--- Disk Usage (Drive C:) ---");
        const disk = await getDiskUsage();
        console.log(disk);
    } catch (error) {
        console.error("Failed to get Disk usage:", error);
    }
    
    console.log("\n--- Health Check Complete ---");
}

runHealthCheck();