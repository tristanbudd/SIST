<?php

namespace App\Console\Commands;

use App\Services\VesselAnalysisService;
use Illuminate\Console\Command;

class AnalyzeVesselActivity extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sist:analyze-activity';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Analyzes historical vessel positions to detect suspicious activity patterns.';

    /**
     * Execute the console command.
     */
    public function handle(VesselAnalysisService $analysisService)
    {
        $this->info('Starting maritime activity analysis...');

        $analysisService->analyzeActiveFleet();

        $this->info('Analysis completed successfully.');
    }
}
