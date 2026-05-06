<?php

namespace App\Console\Commands;

use App\Services\VesselAnalysisService;
use Illuminate\Console\Command;

class RebuildVesselAnalysis extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sist:rebuild-analysis';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clears and rebuilds behavioral analysis for the entire vessel fleet.';

    /**
     * Execute the console command.
     */
    public function handle(VesselAnalysisService $analysisService)
    {
        $this->info('Starting maritime activity analysis rebuild...');

        $analysisService->rebuildAll();

        $this->info('Analysis rebuild completed successfully.');
    }
}
