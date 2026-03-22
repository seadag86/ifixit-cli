import { LoopResult } from './loop';

const REASON_LABELS: Record<LoopResult['reason'], string> = {
  complete: 'All non-PRD issues resolved',
  max_iterations: 'Max iterations reached',
  circuit_breaker: 'Consecutive failure threshold reached',
};

export const printSummary = (result: LoopResult): void => {
  console.log('');
  console.log(`RALPH completed in ${result.iterations} iteration(s)`);
  console.log('');

  if (result.closedIssues.length > 0) {
    console.log('Closed:');
    for (const issue of result.closedIssues) {
      console.log(`  #${issue.number} ${issue.title}`);
    }
  }

  if (result.openIssues.length > 0) {
    console.log('Open:');
    for (const issue of result.openIssues) {
      console.log(`  #${issue.number} ${issue.title}`);
    }
  }

  console.log('');
  console.log(`Commits: ${result.successCount}`);
  console.log(`Reason:  ${REASON_LABELS[result.reason]}`);
};
